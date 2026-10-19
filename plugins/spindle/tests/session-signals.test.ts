import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { NOW, green, integrate, review, spec, threadOnly } from './fixtures/runs'
import { harness } from './harness'

async function status($: Engine): Promise<string[]> {
  const answered = await $.command.run({ command: 'spindle', args: 'status' } as never)
  return String(answered.text ?? '').split('\n')
}

const mspLine = (lines: readonly string[], label: string) => lines.find(line => line.startsWith(`msp ${label} `)) ?? ''

const skill = ($: Engine, name: string, args: string) => $.tool.call({ tool: 'Skill', skill: name, args } as never)

const bash = ($: Engine, command: string) => $.tool.call({ tool: 'Bash', command } as never)

const spawn = ($: Engine, subagentType: string, description: string) =>
  $.agent.spawn({
    tool_use_id: `tool-${description}`,
    prompt: description,
    description,
    subagentType,
    provider: 'engine',
    parentModel: 'claude-opus-5-5',
    background: false,
    fork: false,
  } as never)

function answerTurns(on: On) {
  on('turn.complete', () => ({ text: '' }) as never)
  on('turn.step', async function* () {
    return {
      turnId: 'turn-main',
      index: 0,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn',
      usage: { model: 'claude-opus-5-5', input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    } as never
  })
}

async function step($: Engine) {
  const stream = ($.turn.step as (e: unknown) => AsyncIterable<unknown>)({ turnId: 'turn-main', index: 0, model: 'claude-opus-5-5', messageCount: 1 })
  for await (const chunk of stream) void chunk
}

test('thread id names a run once interphase is called', async ($, on) => {
  const world = harness(on, threadOnly, { now: NOW })
  await world.start($)
  expect(await status($)).toEqual(['No pipeline run in this session.'])

  await skill($, 'interphase:feature', 'Add rate limits. Interview me first.')

  const lines = await status($)
  expect(lines).toContain('run rate-limit-api repo ?')
  expect(lines).toContain('stage spec round 0 finished no')
})

test('create_pull_request call marks its MSP PR open', async ($, on) => {
  const world = harness(on, green, { now: NOW })
  world.answerTool('mcp__github__create_pull_request', { html_url: 'https://github.com/SatanshuMishra/api/pull/41', state: 'open' })
  await world.start($)
  expect(mspLine(await status($), 'limiter-core').startsWith('msp limiter-core green')).toBe(true)

  await $.tool.call({ tool: 'mcp__github__create_pull_request', owner: 'SatanshuMishra', repo: 'api', head: 'mitosis/limiter-core', base: 'main', title: 'feat: add the sliding-window limiter', body: '' } as never)

  const line = mspLine(await status($), 'limiter-core')
  expect(line.startsWith('msp limiter-core pr')).toBe(true)
  expect(line).toContain('pr #41')
})

test('a done run stops reading', async ($, on) => {
  const world = harness(on, integrate, { now: NOW })
  world.answerBash('pipeline clean', 0)
  await world.start($)

  await bash($, 'pipeline clean --repo /home/owner/work/api --slug rate-limit-api')
  expect(await status($)).toContain('stage clean round 0 finished yes')
  const readsAtDone = world.reads().length

  await world.clock.advance(10000)

  expect(world.reads().length).toBe(readsAtDone)
})

test('interview suffix sets the full lane', async ($, on) => {
  const world = harness(on, threadOnly, { now: NOW })
  await world.start($)

  await skill($, 'interphase:feature', 'Add rate limits. Interview me first.')

  expect(await status($)).toContain('lane full')
})

test('autonomous suffix sets the standard lane', async ($, on) => {
  const world = harness(on, threadOnly, { now: NOW })
  await world.start($)

  await skill($, 'interphase:bug', 'Fix the crash. Work autonomously.')

  expect(await status($)).toContain('lane standard')
})

test('resumed session leaves the lane unknown', async ($, on) => {
  const world = harness(on, review, { now: NOW })
  await world.start($)

  expect(await status($)).toContain('lane unknown')
})

test('a later autonomous call keeps the full lane', async ($, on) => {
  const world = harness(on, threadOnly, { now: NOW })
  await world.start($)

  await skill($, 'interphase:feature', 'Add rate limits. Interview me first.')
  await skill($, 'interphase:feature', 'Amend the limiter spec. Work autonomously.')

  expect(await status($)).toContain('lane full')
})

test('run.zsh call moves Spec to Build', async ($, on) => {
  const world = harness(on, spec, { now: NOW })
  await world.start($)
  expect(await status($)).toContain('stage spec round 0 finished no')

  await bash($, '/home/owner/.mitosis/api/rate-limit-api/run.zsh --plan-only')

  expect(await status($)).toContain('stage build round 0 finished no')
})

test('ship call moves to Ship', async ($, on) => {
  const world = harness(on, review, { now: NOW })
  await world.start($)

  await bash($, 'SHIP=1 /home/owner/.mitosis/api/rate-limit-api/run.zsh --resume')

  expect(await status($)).toContain('stage ship round 0 finished no')
})

test('pipeline clean exit 0 is Done', async ($, on) => {
  const world = harness(on, integrate, { now: NOW })
  world.answerBash('pipeline clean', 0)
  await world.start($)

  await bash($, 'pipeline clean --repo /home/owner/work/api --slug rate-limit-api')

  expect(await status($)).toContain('stage clean round 0 finished yes')
})

test('a later file stage wins over an earlier call', async ($, on) => {
  const world = harness(on, review, { now: NOW })
  await world.start($)

  await bash($, '/home/owner/.mitosis/api/rate-limit-api/run.zsh --plan-only')

  expect(await status($)).toContain('stage review round 1 finished no')
})

test('code-reviewer spawn is a Detective', async ($, on) => {
  const world = harness(on, review, { now: NOW })
  world.queueSpawn({ agentId: 'a1', model: 'claude-opus-5-5' })
  await world.start($)

  await spawn($, 'code-reviewer', 'review limiter-core')

  expect(await status($)).toContain('agent a1 detective code-reviewer Opus 5.5 running')
})

test('validator spawn is a Judge', async ($, on) => {
  const world = harness(on, review, { now: NOW })
  world.queueSpawn({ agentId: 'a2', model: 'claude-opus-5-5' })
  await world.start($)

  await spawn($, 'validator', 'validate round 1')

  expect((await status($)).some(line => line.startsWith('agent a2 judge validator'))).toBe(true)
})

test('unknown agent type is a plain crab', async ($, on) => {
  const world = harness(on, review, { now: NOW })
  world.queueSpawn({ agentId: 'a3', model: 'claude-opus-5-5' })
  await world.start($)

  await spawn($, 'general-purpose', 'diagnosis')

  expect((await status($)).some(line => line.startsWith('agent a3 plain general-purpose'))).toBe(true)
})

test('completed agent leaves working now', async ($, on) => {
  answerTurns(on)
  const world = harness(on, review, { now: NOW })
  world.queueSpawn({ agentId: 'a1', model: 'claude-opus-5-5' })
  await world.start($)
  await spawn($, 'code-reviewer', 'review limiter-core')

  await ($.turn.complete as (e: unknown) => Promise<unknown>)({ agentId: 'a1', reason: 'answer', answer: 'ok', turnId: 'turn-a1', durationMs: 1000, isAborted: false })

  const lines = await status($)
  expect(lines).toContain('agent a1 detective code-reviewer Opus 5.5 done')
  expect(lines).toContain('agents 0 live 1 total')
})

test('model steps add to the session cost', async ($, on) => {
  answerTurns(on)
  const world = harness(on, spec, { now: NOW })
  await world.start($)

  await step($)
  await step($)

  expect(await status($)).toContain('cost 0.0280')
})

test('elapsed counts from the oldest run-home file', async ($, on) => {
  const world = harness(on, review, { now: NOW })
  await world.start($)

  expect(await status($)).toContain('elapsed 48m')
})

test('a grep naming pipeline clean during Review is not Done', async ($, on) => {
  const world = harness(on, review, { now: NOW })
  await world.start($)

  await bash($, 'grep -rn "pipeline clean" docs/')

  expect(await status($)).toContain('stage review round 1 finished no')
})

test('reading run.zsh during Spec is not Build', async ($, on) => {
  const world = harness(on, spec, { now: NOW })
  await world.start($)

  await bash($, 'cat /home/owner/.mitosis/api/rate-limit-api/run.zsh')

  expect(await status($)).toContain('stage spec round 0 finished no')
})

test('a grep for SHIP=1 in run.zsh during Review is not Ship', async ($, on) => {
  const world = harness(on, review, { now: NOW })
  await world.start($)

  await bash($, 'grep -n SHIP=1 /home/owner/.mitosis/api/rate-limit-api/run.zsh')

  expect(await status($)).toContain('stage review round 1 finished no')
})

test('a quoted note naming run.zsh during Spec is not Build', async ($, on) => {
  const world = harness(on, spec, { now: NOW })
  await world.start($)

  await bash($, `lb.zsh update_thread '{"next_step":"Run /home/owner/.mitosis/api/rate-limit-api/run.zsh after the review"}'`)

  expect(await status($)).toContain('stage spec round 0 finished no')
})

test('pipeline clean after cd in a compound command is Done', async ($, on) => {
  const world = harness(on, integrate, { now: NOW })
  world.answerBash('pipeline clean', 0)
  await world.start($)

  await bash($, 'cd /home/owner/work/api && pipeline clean --repo /home/owner/work/api --slug rate-limit-api')

  expect(await status($)).toContain('stage clean round 0 finished yes')
})

test('model steps before any run add no cost', async ($, on) => {
  answerTurns(on)
  const world = harness(on, threadOnly, { now: NOW })
  await world.start($)
  expect(await status($)).toEqual(['No pipeline run in this session.'])

  await step($)
  await skill($, 'interphase:feature', 'Add rate limits. Interview me first.')

  expect(await status($)).toContain('cost 0.0000')
})
