import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { NOW, fireplace } from './fixtures/runs'
import { harness } from './harness'

type Drawn = { type?: string; props?: Record<string, unknown>; children?: readonly unknown[] }

const isDrawn = (value: unknown): value is Drawn => typeof value === 'object' && value !== null && 'type' in value

const nodesOf = (value: unknown): Drawn[] =>
  Array.isArray(value)
    ? value.flatMap(nodesOf)
    : isDrawn(value)
      ? [value, ...(value.children ?? []).flatMap(nodesOf)]
      : []

const svgsOf = (tree: unknown) => nodesOf(tree).filter(node => node.type === 'Svg')

async function fireRun($: Engine, on: On) {
  const world = harness(on, fireplace, { now: NOW })
  world.queueSpawn({ agentId: 'a-judge', model: 'claude-opus-5-5' })
  await world.start($)
  await $.tool.call({ tool: 'Skill', skill: 'interphase:feature', args: 'Record video like a camera. Interview me first.' } as never)
}

async function bandAt($: Engine, bodyColumns: number): Promise<unknown> {
  const band = await $.ui.mount({
    plugin: 'spindle',
    surface: 'desktop',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns, scroll: { offset: 0, bodyRows: 4 }, view: {} },
  })
  const tree = await band.drawn()
  await band.unmount()
  return tree
}

async function paneAt($: Engine, bodyColumns: number): Promise<unknown> {
  const pane = await $.ui.mount({
    plugin: 'spindle',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'spindle-run',
    props: { title: '', isFocused: false, bodyColumns, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
  })
  const tree = await pane.drawn()
  await pane.unmount()
  return tree
}

const barSources = (tree: unknown) =>
  svgsOf(tree)
    .map(node => String(node.props?.source ?? ''))
    .filter(source => source.includes('data-part="bar"'))

const railWidth = (tree: unknown) =>
  svgsOf(tree).find(node => String(node.props?.alt ?? '').startsWith('Stage ') && String(node.props?.source ?? '').includes('<circle'))?.props
    ?.width

test('the desktop band bar and pane rail take their width from the surface, not from bodyColumns', async ($, on) => {
  await fireRun($, on)

  const narrowBar = barSources(await bandAt($, 100))
  const wideBar = barSources(await bandAt($, 200))
  const narrowRail = railWidth(await paneAt($, 60))
  const wideRail = railWidth(await paneAt($, 120))

  expect(narrowBar.length).toBe(1)
  expect(wideBar).toEqual(narrowBar)
  expect(narrowRail).toBeUndefined()
  expect(wideRail).toBeUndefined()
})
