import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { NOW, build, fireplace, fix, integrate, review, spec } from './fixtures/runs'
import { harness } from './harness'

type Drawn = { type?: string; props?: Record<string, unknown>; children?: readonly unknown[] }
type SpokenSvg = { alt: string; parent: string }

const isDrawn = (value: unknown): value is Drawn => typeof value === 'object' && value !== null && 'type' in value

const keyOf = (node: Drawn) => String(node.props?.key ?? '')

function svgsOf(value: unknown, parent = '', isVisibleOnly = false, inCard = false): SpokenSvg[] {
  if (Array.isArray(value)) return value.flatMap(child => svgsOf(child, parent, isVisibleOnly, inCard))
  if (!isDrawn(value)) return []
  const card = inCard || (value.type === 'Box' && value.props?.display === 'none')
  const here = value.type === 'Svg' && !(isVisibleOnly && card) ? [{ alt: String(value.props?.alt ?? ''), parent }] : []
  return [...here, ...(value.children ?? []).flatMap(child => svgsOf(child, keyOf(value) || parent, isVisibleOnly, card))]
}

function altsWithoutMeaning(where: string, tree: unknown): string[] {
  const spoken = svgsOf(tree, '', true).filter(svg => svg.alt !== '')
  const repeated = spoken
    .filter(svg => spoken.some(other => other !== svg && other.alt.endsWith(`: ${svg.alt}`)))
    .map(svg => `${where} repeats ${svg.parent}: ${svg.alt}`)
  const fullyBuilt = new Set(spoken.map(svg => /^(.+): (\d+) of \2 lanes built$/.exec(svg.alt)?.[1]).filter(Boolean))
  const stale = spoken
    .filter(svg => fullyBuilt.has(/^(.+): lanes still to build$/.exec(svg.alt)?.[1]))
    .map(svg => `${where} false ${svg.parent}: ${svg.alt}`)
  return [...repeated, ...stale]
}

const unspoken = (where: string, tree: unknown) =>
  svgsOf(tree)
    .filter(svg => svg.alt.trim() === '')
    .map(svg => `${where} ${svg.parent}`)

async function drawnDesktop($: Engine, bodyColumns: number): Promise<{ pane: unknown; band: unknown }> {
  const pane = await $.ui.mount({
    plugin: 'spindle',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'spindle-run',
    props: { title: '', isFocused: false, bodyColumns, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
  })
  const band = await $.ui.mount({
    plugin: 'spindle',
    surface: 'desktop',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns, scroll: { offset: 0, bodyRows: 4 }, view: {} },
  })
  const drawn = { pane: await pane.drawn(), band: await band.drawn() }
  await pane.unmount()
  await band.unmount()
  return drawn
}

const RUNS = { spec, build, review, fix, integrate, fireplace }
const WIDTHS = [40, 59, 60, 100, 160]

for (const [name, run] of Object.entries(RUNS)) {
  test(`every desktop Svg in the ${name} run has a non-empty alt at every width`, async ($, on) => {
    const world = harness(on, run, { now: NOW })
    await world.start($)
    await $.tool.call({ tool: 'Skill', skill: 'interphase:feature', args: 'Probe. Interview me first.' } as never)

    const missing: string[] = []
    for (const columns of WIDTHS) {
      const { pane, band } = await drawnDesktop($, columns)
      missing.push(...unspoken(`${name} pane at ${columns}`, pane), ...unspoken(`${name} band at ${columns}`, band))
    }
    expect(missing).toEqual([])
  })

  test(`every visible desktop Svg alt in the ${name} run carries one meaning, said once and truly`, async ($, on) => {
    const world = harness(on, run, { now: NOW })
    await world.start($)
    await $.tool.call({ tool: 'Skill', skill: 'interphase:feature', args: 'Probe. Interview me first.' } as never)

    const { pane, band } = await drawnDesktop($, 100)
    expect([...altsWithoutMeaning(`${name} pane`, pane), ...altsWithoutMeaning(`${name} band`, band)]).toEqual([])
  })
}
