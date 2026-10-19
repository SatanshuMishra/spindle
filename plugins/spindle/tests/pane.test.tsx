import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { NOW, build, fix, review } from './fixtures/runs'
import { harness } from './harness'

const PANE_PROPS = { title: '', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} } as const

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

const mountPane = ($: Engine, surface: 'desktop' | 'terminal') =>
  $.ui.mount({ plugin: 'spindle', surface, component: 'Pane', requestId: 'spindle-run', props: PANE_PROPS })

async function svgAlts($: Engine): Promise<string[]> {
  const pane = await mountPane($, 'desktop')
  const alts = (await pane.findAll({ type: 'Svg' })).map(one => String(one.props.alt ?? ''))
  await pane.unmount()
  return alts
}

async function fixRun($: Engine, on: On) {
  const world = harness(on, fix, { now: NOW })
  world.queueSpawn({ agentId: 'a-judge', model: 'claude-opus-5-5' })
  await world.start($)
  await skill($, 'interphase:feature', 'Add rate limits. Interview me first.')
  await spawn($, 'validator', 'validate round 1')
  return world
}

test('desktop pane at Fix shows every section', async ($, on) => {
  await fixRun($, on)

  const alts = await svgAlts($)
  expect(alts).toContain('rate-limit-api, Full lane')
  expect(alts).toContain('Stage Fix')
  expect(alts).toContain('limiter-core: Fixing')
  expect(alts).toContain('redis-store: Green')
  expect(alts).toContain('Judge: validator')
  expect(alts).toContain('Round 1 limiter-core: loop')
})

test('terminal pane at Fix shows the same words', async ($, on) => {
  await fixRun($, on)

  const pane = await mountPane($, 'terminal')
  const rows = (await pane.findAll({ type: 'Text' })).map(one => String(one.text ?? ''))
  const text = rows.join('\n')
  for (const word of ['limiter-core', 'Fixing', 'redis-store', 'Green', 'Judge', 'R1', 'loop', '≈$']) {
    expect(text).toContain(word)
  }
  expect((await pane.findAll({ type: 'Svg' })).length).toBe(0)
})

test('build pane shows the Builder row and proof dots', async ($, on) => {
  const world = harness(on, build, { now: NOW })
  await world.start($)

  expect(await svgAlts($)).toContain('Builder ×1')

  world.use(review)
  await world.clock.advance(2000)

  const pane = await mountPane($, 'desktop')
  const limiter = (await pane.findAll({ type: 'Svg' })).find(one => one.props.alt === 'limiter-core: In review')
  expect(String(limiter?.props.source ?? '')).toContain('fill="#D0453F"')
})
