import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { NOW, build, fix, fixRound2, review, spec } from './fixtures/runs'
import { harness } from './harness'

const BAND_PROPS = { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 100, scroll: { offset: 0, bodyRows: 4 }, view: {} } as const

const skill = ($: Engine, name: string, args: string) => $.tool.call({ tool: 'Skill', skill: name, args } as never)

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

const mountBand = ($: Engine, surface: 'desktop' | 'terminal') =>
  $.ui.mount({ plugin: 'spindle', surface, component: 'AbovePrompt', props: BAND_PROPS })

async function desktopSource($: Engine): Promise<string> {
  const band = await mountBand($, 'desktop')
  const source = String((await band.find({ type: 'Svg' }))?.props.source ?? '')
  await band.unmount()
  return source
}

async function reviewRun($: Engine, on: On) {
  const world = harness(on, review, { now: NOW })
  world.queueSpawn({ agentId: 'a1', model: 'claude-opus-5-5' })
  await world.start($)
  await skill($, 'interphase:feature', 'Add rate limits. Interview me first.')
  await spawn($, 'code-reviewer', 'review limiter-core')
  return world
}

test('desktop band shows slug, lane and Review R1', async ($, on) => {
  await reviewRun($, on)

  const band = await mountBand($, 'desktop')
  const svgs = await band.findAll({ type: 'Svg' })
  expect(svgs.length).toBe(1)
  expect(svgs[0]?.props.alt).toBe('rate-limit-api: Review · R1')
  const source = String(svgs[0]?.props.source ?? '')
  expect(source).toContain('rate-limit-api')
  expect(source).toContain('Full')
  expect(source).toContain('Review · R1')
  expect(source).toContain('c-detective')
})

test('terminal band is text', async ($, on) => {
  await reviewRun($, on)

  const band = await mountBand($, 'terminal')
  const row = await band.find({ type: 'Text', text: /● rate-limit-api/ })
  expect(row).toBeDefined()
  expect(row?.text).toContain('● rate-limit-api')
  expect(row?.text).toContain('[Full]')
  expect(row?.text).toContain('Review R1')
  expect(row?.text).toContain('3 MSPs')
  expect((await band.findAll({ type: 'Svg' })).length).toBe(0)
})

test('crew button opens the pane', async ($, on) => {
  const world = await reviewRun($, on)

  const band = await mountBand($, 'desktop')
  expect((await band.find({ key: 'spindle-crew' }))?.props.label).toBe('×1')
  await band.press({ key: 'spindle-crew' })

  expect(world.opened()).toContain('spindle-run')
})

test('dismiss hides the band until the stage changes', async ($, on) => {
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return Text({ children: 'another band' })
  })
  const world = harness(on, review, { now: NOW })
  await world.start($)

  const band = await mountBand($, 'desktop')
  expect(await band.find({ key: 'spindle-dismiss' })).toBeDefined()
  await band.press({ key: 'spindle-dismiss' })
  expect(await band.drawn()).toMatchObject({ type: 'Text', children: ['another band'] })
  expect(await band.find({ key: 'spindle-crew' })).toBeUndefined()
  expect((await band.findAll({ type: 'Svg' })).length).toBe(0)

  world.use(fix)
  await world.clock.advance(2000)

  const again = await mountBand($, 'desktop')
  expect(await again.find({ key: 'spindle-crew' })).toBeDefined()
  expect((await again.find({ type: 'Svg' }))?.props.alt).toBe('rate-limit-api: Fix · R1')
})

test('a dismiss at Review R1 does not hide Review R2 after Fix', async ($, on) => {
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return Text({ children: 'another band' })
  })
  const world = harness(on, review, { now: NOW })
  await world.start($)

  const band = await mountBand($, 'desktop')
  await band.press({ key: 'spindle-dismiss' })

  world.use(fix)
  await world.clock.advance(2000)
  const atFix = await mountBand($, 'desktop')
  expect((await atFix.find({ type: 'Svg' }))?.props.alt).toBe('rate-limit-api: Fix · R1')

  world.use(fixRound2)
  await world.clock.advance(2000)
  const atReview = await mountBand($, 'desktop')
  expect(await atReview.find({ key: 'spindle-crew' })).toBeDefined()
  expect((await atReview.find({ type: 'Svg' }))?.props.alt).toBe('rate-limit-api: Review · R2')
})

test('every costume draws with clay and reduced motion', async ($, on) => {
  on('tool.call', { tool: 'mcp__github__create_pull_request' }, async () => {
    await world.clock.sleep(5000)
    return { result: { html_url: 'https://github.com/SatanshuMishra/api/pull/41' } } as never
  })
  const world = harness(on, spec, { now: NOW })
  world.queueSpawn({ agentId: 'a-scout', model: 'claude-opus-5-5' })
  world.queueSpawn({ agentId: 'a-review', model: 'claude-opus-5-5' })
  world.queueSpawn({ agentId: 'a-judge', model: 'claude-opus-5-5' })
  await world.start($)

  const captain = await desktopSource($)

  world.use(build)
  await world.clock.advance(2000)
  const builder = await desktopSource($)

  await spawn($, 'interphase:scout', 'find the limiter docs')
  const scribe = await desktopSource($)

  await spawn($, 'code-reviewer', 'review limiter-core')
  const detective = await desktopSource($)

  await spawn($, 'validator', 'validate round 1')
  const judge = await desktopSource($)

  const opening = $.tool.call({ tool: 'mcp__github__create_pull_request', head: 'mitosis/limiter-core', base: 'main', title: 'feat: add the limiter', body: '' } as never)
  await world.clock.settle()
  const courier = await desktopSource($)
  await world.clock.advance(5000)
  await opening

  const seen = { captain, scribe, builder, detective, judge, courier }
  for (const [role, source] of Object.entries(seen)) {
    expect(source).toContain('fill="#D97757"')
    expect(source).toContain(`class="c-${role}`)
    expect(source).toContain('prefers-reduced-motion')
  }
})
