import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { NOW, build, fireplace, fix, integrate, review, spec } from './fixtures/runs'
import { harness } from './harness'

type Drawn = { type?: string; props?: Record<string, unknown>; children?: readonly unknown[] }
type SpokenSvg = { alt: string; parent: string }

const isDrawn = (value: unknown): value is Drawn => typeof value === 'object' && value !== null && 'type' in value

const keyOf = (node: Drawn) => String(node.props?.key ?? '')

function visibleSvgsOf(value: unknown, parent = '', inCard = false): SpokenSvg[] {
  if (Array.isArray(value)) return value.flatMap(child => visibleSvgsOf(child, parent, inCard))
  if (!isDrawn(value)) return []
  const card = inCard || (value.type === 'Box' && value.props?.display === 'none')
  const here = value.type === 'Svg' && !card ? [{ alt: String(value.props?.alt ?? ''), parent }] : []
  return [...here, ...(value.children ?? []).flatMap(child => visibleSvgsOf(child, keyOf(value) || parent, card))]
}

const DECORATIVE_PARENT = /^(rail-link-|spindle-tick-|msp-bar-rest-)/

function altsWithoutMeaning(where: string, tree: unknown): string[] {
  const spoken = visibleSvgsOf(tree).filter(svg => svg.alt !== '')
  const decorative = spoken.filter(svg => DECORATIVE_PARENT.test(svg.parent)).map(svg => `${where} decorative ${svg.parent}: ${svg.alt}`)
  const repeated = spoken
    .filter(svg => spoken.some(other => other !== svg && other.alt.endsWith(`: ${svg.alt}`)))
    .map(svg => `${where} repeats ${svg.parent}: ${svg.alt}`)
  const fullyBuilt = new Set(spoken.map(svg => /^(.+): (\d+) of \2 lanes built$/.exec(svg.alt)?.[1]).filter(Boolean))
  const stale = spoken
    .filter(svg => fullyBuilt.has(/^(.+): lanes still to build$/.exec(svg.alt)?.[1]))
    .map(svg => `${where} false ${svg.parent}: ${svg.alt}`)
  return [...decorative, ...repeated, ...stale]
}

async function drawnDesktop($: Engine): Promise<{ pane: unknown; band: unknown }> {
  const pane = await $.ui.mount({
    plugin: 'spindle',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'spindle-run',
    props: { title: '', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
  })
  const band = await $.ui.mount({
    plugin: 'spindle',
    surface: 'desktop',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 100, scroll: { offset: 0, bodyRows: 4 }, view: {} },
  })
  return { pane: await pane.drawn(), band: await band.drawn() }
}

for (const [name, run] of Object.entries({ spec, build, review, fix, integrate, fireplace })) {
  test(`every visible desktop Svg alt in the ${name} run carries one meaning, said once and truly`, async ($, on) => {
    const world = harness(on, run, { now: NOW })
    await world.start($)
    await $.tool.call({ tool: 'Skill', skill: 'interphase:feature', args: 'Probe. Interview me first.' } as never)

    const { pane, band } = await drawnDesktop($)
    expect([...altsWithoutMeaning(`${name} pane`, pane), ...altsWithoutMeaning(`${name} band`, band)]).toEqual([])
  })
}
