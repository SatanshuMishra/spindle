import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { FIRE_TREES, NOW, build, fireplace, spec } from './fixtures/runs'
import { harness } from './harness'

async function status($: Engine): Promise<string[]> {
  const answered = await $.command.run({ command: 'spindle', args: 'status' } as never)
  return String(answered.text ?? '').split('\n')
}

const spawn = ($: Engine, subagentType: string, prompt: string, description: string) =>
  $.agent.spawn({
    tool_use_id: `tool-${description}`,
    prompt,
    description,
    subagentType,
    provider: 'engine',
    parentModel: 'claude-opus-5-5',
    background: false,
    fork: false,
  } as never)

const BUTTON_TREE = FIRE_TREES.find(tree => tree.label === 'button-consistency')?.path ?? ''

test('a validator naming an MSP belongs to it', async ($, on) => {
  const world = harness(on, fireplace, { now: NOW })
  world.queueSpawn({ agentId: 'a-judge', model: 'claude-opus-5-5' })
  await world.start($)

  await spawn($, 'validator', 'Validate round 4 of video-starts-like-a-camera', 'validate the round')

  const lines = await status($)
  expect(
    lines.some(
      line => line.startsWith('worker video-starts-like-a-camera judge Round 4 · validating') && line.endsWith('· live'),
    ),
  ).toBe(true)
})

test('a worktree path names its MSP', async ($, on) => {
  const world = harness(on, fireplace, { now: NOW })
  world.queueSpawn({ agentId: 'a-review', model: 'claude-opus-5-5' })
  await world.start($)
  expect(BUTTON_TREE).not.toContain('button-consistency')

  await spawn($, 'code-reviewer', `Review the diff in ${BUTTON_TREE} against the spec.`, 'review the worktree')

  const lines = await status($)
  expect(lines.some(line => line.startsWith('worker button-consistency detective Round 4 · reviewing'))).toBe(true)
})

test('an agent naming no MSP is unattributed', async ($, on) => {
  const world = harness(on, fireplace, { now: NOW })
  world.queueSpawn({ agentId: 'a-scout', model: 'claude-opus-5-5' })
  await world.start($)

  await spawn($, 'interphase:scout', 'Find the mod API tooltip props', 'Find the mod API tooltip props')

  const lines = await status($)
  expect(lines.some(line => line.startsWith('worker - ') && line.includes('Find the mod API tooltip props'))).toBe(true)
})

test('builder lanes read building and done', async ($, on) => {
  const world = harness(on, build, { now: NOW })
  await world.start($)

  const lines = await status($)
  expect(lines).toContain('worker limiter-core builder Lane 0 · done · done')
  expect(lines).toContain('worker limiter-core builder Lane 1 · building · live')
})

test('a finished round lists its reviewers and judge', async ($, on) => {
  const world = harness(on, fireplace, { now: NOW })
  await world.start($)

  const lines = await status($)
  expect(lines).toContain('worker video-starts-like-a-camera detective Round 4 · code-reviewer · 2 findings · done')
  expect(lines).toContain('worker video-starts-like-a-camera detective Round 4 · security-reviewer · 1 finding · done')
  expect(lines).toContain('worker video-starts-like-a-camera judge Round 4 · loop · 1 blocker, 1 advisory · take lost on sound failure · done')
})

test('diagnosis and smoke files become rows', async ($, on) => {
  const world = harness(on, fireplace, { now: NOW })
  await world.start($)

  const lines = await status($)
  expect(lines).toContain('worker button-consistency diagnosis Round 4 · diagnosed · hand-built tap target · done')
  expect(lines).toContain('worker button-consistency smoke Round 4 · smoke · windows · done')
})

test('the main thread shows only when nothing else works', async ($, on) => {
  const world = harness(on, spec, { now: NOW })
  world.queueSpawn({ agentId: 'a-scout', model: 'claude-opus-5-5' })
  await world.start($)

  expect(await status($)).toContain('worker - captain main thread · live')

  await spawn($, 'interphase:scout', 'Find the mod API tooltip props', 'Find the mod API tooltip props')

  expect((await status($)).some(line => line.startsWith('worker - captain'))).toBe(false)
})

test('a resumed session lists finished workers from files', async ($, on) => {
  const world = harness(on, fireplace, { now: NOW })
  await world.start($)

  const lines = await status($)
  const judged = [
    'worker mic-recovery judge Round 1 · ',
    'worker mic-recovery judge Round 2 · ',
    'worker video-starts-like-a-camera judge Round 1 · ',
    'worker video-starts-like-a-camera judge Round 2 · ',
    'worker video-starts-like-a-camera judge Round 3 · ',
    'worker video-starts-like-a-camera judge Round 4 · ',
    'worker hearing-and-ring judge Round 1 · ',
    'worker hearing-and-ring judge Round 2 · ',
    'worker button-consistency judge Round 1 · ',
    'worker button-consistency judge Round 2 · ',
    'worker button-consistency judge Round 3 · ',
  ]
  for (const start of judged) expect(lines.some(line => line.startsWith(start) && line.endsWith(' · done'))).toBe(true)
  expect(lines).toContain('worker mic-recovery judge Round 2 · green · no findings · done')
})
