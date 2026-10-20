import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { NOW, SF, build, fix, fixRound2, green, integrate, review, ship, spec, split, threadOnly, withFile } from './fixtures/runs'
import type { Fixture } from './harness'
import { harness } from './harness'

const PANE_PROPS = { title: '', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} } as const
const BAND_PROPS = { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 100, scroll: { offset: 0, bodyRows: 4 }, view: {} } as const

const RUN_ZSH = '/home/owner/.mitosis/api/rate-limit-api/run.zsh'

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

const timesSeen = (toasts: readonly string[], text: string) => toasts.filter(one => one === text).length

async function mountEverywhere($: Engine) {
  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ plugin: 'spindle', surface, component: 'AbovePrompt', props: BAND_PROPS })
    await band.drawn()
    await band.unmount()
    const pane = await $.ui.mount({ plugin: 'spindle', surface, component: 'Pane', requestId: 'spindle-run', props: PANE_PROPS })
    await pane.drawn()
    await pane.unmount()
  }
}

test('first read raises no toast', async ($, on) => {
  const world = harness(on, fix, { now: NOW })
  await world.start($)
  await world.clock.advance(2000)

  expect(world.toasts()).toEqual([])
})

const STAGE_NAMES = ['Spec', 'Build', 'Review', 'Fix', 'Ship', 'Integrate', 'Clean-up', 'Done'] as const

test('a new verdict toasts its outcome and first kind', async ($, on) => {
  const world = harness(on, review, { now: NOW })
  await world.start($)
  expect(world.toasts()).toEqual([])

  world.use(fix)
  await world.clock.advance(2000)
  await world.clock.advance(2000)

  expect(timesSeen(world.toasts(), 'limiter-core round 1: Needs fixes · 2 blockers, 1 advisory · window resets one request early')).toBe(1)
  expect(world.toasts().filter(toast => STAGE_NAMES.some(stage => toast === `rate-limit-api: ${stage}`))).toEqual([])
})

test('a green verdict toast has no kind part', async ($, on) => {
  const world = harness(on, fixRound2, { now: NOW })
  await world.start($)

  world.use(green)
  await world.clock.advance(2000)

  expect(world.toasts()).toContain('limiter-core round 2: Green · no findings')
})

test('pull request toast', async ($, on) => {
  const world = harness(on, green, { now: NOW })
  await world.start($)

  world.use(ship)
  await world.clock.advance(2000)

  expect(world.toasts()).toContain('limiter-core: pull request #41 opened')
})

test('a whole run writes nothing', async ($, on) => {
  const world = harness(on, spec, { now: NOW })
  world.queueSpawn({ agentId: 'a-review', model: 'claude-opus-5-5' })
  world.queueSpawn({ agentId: 'a-judge', model: 'claude-opus-5-5' })
  world.answerTool('mcp__github__create_pull_request', { html_url: 'https://github.com/SatanshuMishra/api/pull/41', state: 'open' })
  world.answerBash('pipeline clean', 0)
  await world.start($)

  const walk: readonly { fixture: Fixture; call: () => Promise<unknown> }[] = [
    { fixture: spec, call: () => skill($, 'interphase:feature', 'Add rate limits. Interview me first.') },
    { fixture: build, call: () => bash($, RUN_ZSH) },
    { fixture: review, call: () => spawn($, 'code-reviewer', 'review limiter-core') },
    { fixture: fix, call: () => spawn($, 'validator', 'validate round 1') },
    { fixture: fixRound2, call: async () => undefined },
    { fixture: green, call: () => bash($, `SHIP=1 ${RUN_ZSH}`) },
    {
      fixture: ship,
      call: () =>
        $.tool.call({ tool: 'mcp__github__create_pull_request', owner: 'SatanshuMishra', repo: 'api', head: 'mitosis/limiter-core', base: 'main', title: 'feat: add the sliding-window limiter', body: '' } as never),
    },
    {
      fixture: integrate,
      call: async () => {
        await skill($, 'lighthouse:test', '--repo /home/owner/work/api --feature feature/rate-limit-api')
        await bash($, 'pipeline clean --repo /home/owner/work/api --slug rate-limit-api')
      },
    },
  ]

  for (const { fixture, call } of walk) {
    world.use(fixture)
    await call()
    await world.clock.advance(2000)
    await mountEverywhere($)
  }

  const finished = await $.command.run({ command: 'spindle', args: 'status' } as never)
  expect(String(finished.text ?? '')).toContain('finished yes')
  expect(world.writes()).toEqual([])
})

test('a thread-only run gaining its home raises no toast', async ($, on) => {
  const world = harness(on, threadOnly, { now: NOW })
  await world.start($)
  await skill($, 'pipeline:run', '')
  await world.clock.advance(2000)

  world.use(fix)
  await world.clock.advance(2000)
  await world.clock.advance(2000)

  expect(world.toasts()).toEqual([])
})

test('a different run home with the same slug raises no toast', async ($, on) => {
  const world = harness(on, split, { now: NOW })
  await world.start($)
  await world.clock.advance(2000)

  world.use(withFile(fix, SF, fix.files[SF]!.text, NOW - 60_000))
  await world.clock.advance(2000)
  await world.clock.advance(2000)

  expect(world.toasts()).toEqual([])
})
