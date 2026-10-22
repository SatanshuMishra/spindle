import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import type { Fixture, FixtureFile } from './harness'
import { harness } from './harness'
import { H, NOW, R, integrate, withFile } from './fixtures/runs'

const RECORD = '/home/owner/.mitosis/api/records/rate-limit-api'
const EVENTS = '/home/owner/.mitosis/api/events/rate-limit-api.jsonl'
const LIGHTHOUSE = `${H}/lighthouse/run-1/verdict.json`
const SLUG = 'rate-limit-api'

const bandProps = (bodyColumns: number) =>
  ({ hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns, scroll: { offset: 0, bodyRows: 4 }, view: {} }) as const

const mountBand = ($: Engine, surface: 'desktop' | 'terminal', bodyColumns = 100) =>
  $.ui.mount({ plugin: 'spindle', surface, component: 'AbovePrompt', props: bandProps(bodyColumns) })

const paneProps = { title: '', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } as const

type Drawn = { type?: string; props?: Record<string, unknown>; children?: readonly unknown[] }

const isDrawn = (value: unknown): value is Drawn => typeof value === 'object' && value !== null && 'type' in value

const isCard = (node: Drawn) => node.type === 'Box' && node.props?.display === 'none'

const nodesOf = (value: unknown): Drawn[] =>
  Array.isArray(value)
    ? value.flatMap(nodesOf)
    : isDrawn(value) && !isCard(value)
      ? [value, ...(value.children ?? []).flatMap(nodesOf)]
      : []

const textOf = (node: Drawn) => (node.children ?? []).filter(child => typeof child === 'string').join('')

const textsOf = (tree: unknown) => nodesOf(tree).filter(node => node.type === 'Text').map(textOf)

const svgsOf = (tree: unknown) =>
  nodesOf(tree)
    .filter(node => node.type === 'Svg')
    .map(node => ({ alt: String(node.props?.alt ?? ''), source: String(node.props?.source ?? '') }))

const celebrationOf = (tree: unknown) => svgsOf(tree).filter(svg => svg.alt.startsWith('Celebration'))

const barOf = (tree: unknown) => svgsOf(tree).find(svg => svg.source.includes('data-part="bar"'))

const pillOf = (tree: unknown) => svgsOf(tree).find(svg => svg.source.includes('data-part="pill"'))

const event = (ev: string, fields: Readonly<Record<string, unknown>> = {}) =>
  JSON.stringify({ v: 1, ev, ts: '2026-10-21T20:00:00Z', run: 'api/rate-limit-api', ...fields })

const STARTED = [event('run.start', { lane: 'full' }), event('stage.start', { stage: 'spec' }), event('stage.start', { stage: 'build' })]
const AT_INTEGRATE = [...STARTED, event('stage.start', { stage: 'integrate' })]
const CLEANED = [...STARTED, event('stage.start', { stage: 'clean' }), event('clean.done', { record: RECORD, kept: 0 })]
const DONE = event('run.end', { status: 'done' })
const STOPPED = event('run.end', { status: 'abandoned: stopped at review: hard failure' })

const logged = (base: Fixture, lines: readonly string[], mtimeMs = NOW): Fixture => ({
  files: { ...base.files, [EVENTS]: { text: `${lines.join('\n')}\n`, mtimeMs } },
})

const recordPath = (path: string) =>
  path.startsWith(`${H}/`) ? `${RECORD}/home${path.slice(H.length)}` : path.startsWith(`${R}/`) ? `${RECORD}/run${path.slice(R.length)}` : path

const recorded = (base: Fixture): Fixture => ({
  files: Object.fromEntries(Object.entries(base.files).map(([path, one]): [string, FixtureFile] => [recordPath(path), one])),
})

const greenIntegrate = withFile(integrate, LIGHTHOUSE, { verdict: 'green' }, NOW - 5_000)

const celebratedRecord = recorded(logged(greenIntegrate, [...CLEANED, DONE]))

const animationDurations = (source: string) => [...source.matchAll(/animation-duration:([\d.]+)s/g)].map(match => Number(match[1]))
const animationDelays = (source: string) => [...source.matchAll(/animation-delay:([\d.]+)s/g)].map(match => Number(match[1]))

async function turnsDone($: Engine, on: On) {
  const world = harness(on, logged(greenIntegrate, AT_INTEGRATE), { now: NOW })
  await world.start($)
  world.use(logged(greenIntegrate, [...AT_INTEGRATE, DONE], NOW + 1_000))
  await world.clock.advance(2000)
  return world
}

async function turnsStopped($: Engine, on: On) {
  const world = harness(on, logged(integrate, STARTED), { now: NOW })
  await world.start($)
  world.use(logged(integrate, [...STARTED, STOPPED], NOW + 1_000))
  await world.clock.advance(2000)
  return world
}

async function drawnOnce($: Engine, surface: 'desktop' | 'terminal', bodyColumns = 100): Promise<unknown> {
  const band = await mountBand($, surface, bodyColumns)
  const tree = await band.drawn()
  await band.unmount()
  return tree
}

async function status($: Engine): Promise<string[]> {
  const answered = await $.command.run({ command: 'spindle', args: 'status' } as never)
  return String(answered.text ?? '').split('\n')
}

const showAnotherBand = (on: On) =>
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return Text({ children: 'another band' })
  })

test('band shows the compact celebration when the run turns celebrated', async ($, on) => {
  await turnsDone($, on)

  const celebration = celebrationOf(await drawnOnce($, 'desktop'))
  expect(celebration.map(svg => svg.alt)).toEqual([`Celebration: ${SLUG} finished clean`])
  const source = celebration[0]?.source ?? ''
  expect(source).toContain('@keyframes')
  expect(source).toContain('animation-iteration-count:1')
  expect(source).not.toContain('infinite')
  expect(Math.max(...animationDelays(source)) + Math.max(...animationDurations(source))).toBeLessThanOrEqual(3)
  expect(source).toMatch(/@media \(prefers-reduced-motion: reduce\)\{[^}]*animation:none/)
})

test('band settles to one compact line after five seconds', async ($, on) => {
  const world = await turnsDone($, on)
  const band = await mountBand($, 'desktop')
  expect(celebrationOf(await band.drawn())).toHaveLength(1)

  await world.clock.advance(5000)
  await world.clock.advance(2000)

  const tree = await band.drawn()
  expect(textsOf(tree)).toContain(`${SLUG} · Finished clean`)
  expect(celebrationOf(tree)).toEqual([])
  expect(barOf(tree)).toBeUndefined()
  await band.unmount()
})

test('a stopped run settles to its own headline and never celebrates', async ($, on) => {
  const world = await turnsStopped($, on)
  const band = await mountBand($, 'desktop')
  expect(celebrationOf(await band.drawn())).toEqual([])

  await world.clock.advance(5000)
  await world.clock.advance(2000)

  const tree = await band.drawn()
  expect(celebrationOf(tree)).toEqual([])
  expect(textsOf(tree)).toContain(`${SLUG} · Stopped at review: hard failure`)
  await band.unmount()
})

test('a run finished at first read shows the compact line at once', async ($, on) => {
  const world = harness(on, celebratedRecord, { now: NOW })
  await world.start($)

  const tree = await drawnOnce($, 'desktop')
  expect(textsOf(tree)).toContain(`${SLUG} · Finished clean`)
  expect(celebrationOf(tree)).toEqual([])
})

test('terminal band shows the finish headline', async ($, on) => {
  const world = harness(on, celebratedRecord, { now: NOW })
  await world.start($)

  expect(textsOf(await drawnOnce($, 'terminal')).some(text => text.includes('Finished clean'))).toBe(true)
})

test("a finished band's bar does not animate", async ($, on) => {
  await turnsDone($, on)

  const bar = barOf(await drawnOnce($, 'desktop', 200))
  expect(bar).toBeDefined()
  expect(bar?.source).not.toContain('animation')
})

test("a stopped run's pill reads Stopped", async ($, on) => {
  await turnsStopped($, on)

  expect(pillOf(await drawnOnce($, 'desktop', 40))?.alt).toBe(`${SLUG}: Stopped`)
})

test('/spindle on a finished run hides it from the band and keeps it in the pane', async ($, on) => {
  showAnotherBand(on)
  const world = harness(on, celebratedRecord, { now: NOW })
  await world.start($)

  await $.command.run({ command: 'spindle', args: '' } as never)

  expect(await drawnOnce($, 'desktop')).toMatchObject({ type: 'Text', children: ['another band'] })
  expect(world.opened()).toContain('spindle-run')
  const pane = await $.ui.mount({ plugin: 'spindle', surface: 'desktop', component: 'Pane', requestId: 'spindle-run', props: paneProps })
  expect(textsOf(await pane.drawn()).some(text => text.includes(SLUG))).toBe(true)
  await pane.unmount()
  expect((await status($)).some(line => line.startsWith(`run ${SLUG}`))).toBe(true)
})
