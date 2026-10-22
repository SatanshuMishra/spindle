import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import type { Fixture, FixtureFile } from './harness'
import { harness } from './harness'
import { H, NOW, R, green, integrate, review, withFile } from './fixtures/runs'

const RECORD = '/home/owner/.mitosis/api/records/rate-limit-api'
const EVENTS = '/home/owner/.mitosis/api/events/rate-limit-api.jsonl'
const LIGHTHOUSE = `${H}/lighthouse/run-1/verdict.json`

const paneProps = (bodyColumns: number) =>
  ({ title: '', isFocused: false, bodyColumns, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} }) as const

const mountPane = ($: Engine, surface: 'desktop' | 'terminal', bodyColumns = 100) =>
  $.ui.mount({ plugin: 'spindle', surface, component: 'Pane', requestId: 'spindle-run', props: paneProps(bodyColumns) })

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

const event = (ev: string, fields: Readonly<Record<string, unknown>> = {}) =>
  JSON.stringify({ v: 1, ev, ts: '2026-10-21T20:00:00Z', run: 'api/rate-limit-api', ...fields })

const STARTED = [event('run.start', { lane: 'full' }), event('stage.start', { stage: 'spec' }), event('stage.start', { stage: 'build' })]
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

const withLighthouse = (base: Fixture, verdict: string) => withFile(base, LIGHTHOUSE, { verdict }, NOW - 5_000)

const greenIntegrate = withLighthouse(integrate, 'green')

const blockedRedis = withFile(
  green,
  `${H}/review/round-1/redis-store.verdict.json`,
  { outcome: 'blocked', round: 1, blockers: ['store drops the counter on reconnect'], advisories: [], diagnose: [], blocked: [] },
  NOW - 60_000,
)

async function desktopTree($: Engine): Promise<unknown> {
  const pane = await mountPane($, 'desktop')
  const tree = await pane.drawn()
  await pane.unmount()
  return tree
}

async function terminalTexts($: Engine): Promise<string[]> {
  const pane = await mountPane($, 'terminal', 80)
  const texts = textsOf(await pane.drawn())
  await pane.unmount()
  return texts
}

const animationDurations = (source: string) => [...source.matchAll(/animation-duration:([\d.]+)s/g)].map(match => Number(match[1]))
const animationDelays = (source: string) => [...source.matchAll(/animation-delay:([\d.]+)s/g)].map(match => Number(match[1]))

test('closed-done without a green lighthouse verdict says why there is no celebration', async ($, on) => {
  const world = harness(on, recorded(logged(withLighthouse(integrate, 'failures'), [...CLEANED, DONE])), { now: NOW })
  await world.start($)

  const tree = await desktopTree($)
  const texts = textsOf(tree)
  expect(texts).toContain('Done')
  expect(texts).toContain('No celebration: lighthouse verdict failures')
  expect(celebrationOf(tree)).toEqual([])
})

test('closed-draft finish names each blocked MSP', async ($, on) => {
  const world = harness(on, recorded(logged(blockedRedis, [...CLEANED, event('run.end', { status: 'done', draft: true })])), { now: NOW })
  await world.start($)

  const texts = textsOf(await desktopTree($))
  expect(texts).toContain('Ended as a draft pull request')
  expect(texts).toContain('redis-store blocked')
})

test('stopped finish names the stage and blocker', async ($, on) => {
  const world = harness(on, logged(review, [...STARTED, STOPPED]), { now: NOW })
  await world.start($)

  expect(textsOf(await desktopTree($))).toContain('Stopped at review: hard failure')
})

test('superseded finish names the replacing run', async ($, on) => {
  const world = harness(on, recorded(logged(review, [...CLEANED, event('run.end', { status: 'abandoned: superseded by rate-limit-api-2' })])), {
    now: NOW,
  })
  await world.start($)

  expect(textsOf(await desktopTree($))).toContain('Superseded by rate-limit-api-2')
})

test('cleaned finish says the thread has not closed', async ($, on) => {
  const world = harness(on, recorded(logged(review, CLEANED)), { now: NOW })
  await world.start($)

  const texts = textsOf(await desktopTree($))
  expect(texts).toContain('Cleaned up')
  expect(texts).toContain('The thread has not closed yet')
})

test('unknown finish says the event log could not be read', async ($, on) => {
  const world = harness(on, recorded(logged(review, [...CLEANED, DONE])), { now: NOW })
  world.failRead(EVENTS, 'EACCES: permission denied')
  await world.start($)

  const texts = textsOf(await desktopTree($))
  expect(texts).toContain('Status unknown')
  expect(texts).toContain('The event log could not be read')
})

test('terminal pane shows the finish headline', async ($, on) => {
  const world = harness(on, logged(review, [...STARTED, STOPPED]), { now: NOW })
  await world.start($)

  expect(await terminalTexts($)).toContain('Stopped at review: hard failure')
})

test('an abandoned finish shows its reason', async ($, on) => {
  const world = harness(on, recorded(logged(review, [...CLEANED, event('run.end', { status: 'abandoned: owner dropped the work' })])), {
    now: NOW,
  })
  await world.start($)

  const texts = textsOf(await desktopTree($))
  expect(texts).toContain('Abandoned')
  expect(texts).toContain('Owner dropped the work')
})

test("a stopped run's stage reads Stopped, not Done", async ($, on) => {
  const world = harness(on, logged(review, [...STARTED, STOPPED]), { now: NOW })
  await world.start($)

  const stageLine = (await terminalTexts($)).find(text => text.startsWith('Stage ')) ?? ''
  expect(stageLine).toContain('Stopped')
  expect(stageLine).not.toContain('Done')
})

test('celebration plays when the run turns celebrated during the session', async ($, on) => {
  const world = harness(on, logged(greenIntegrate, STARTED), { now: NOW })
  await world.start($)
  world.use(logged(greenIntegrate, [...STARTED, event('stage.start', { stage: 'integrate' }), DONE], NOW + 1_000))
  await world.clock.advance(2000)

  const pane = await mountPane($, 'desktop')
  const tree = await pane.drawn()
  expect(textsOf(tree)).toContain('Finished clean')
  const celebration = celebrationOf(tree)
  expect(celebration.map(svg => svg.alt)).toEqual(['Celebration: rate-limit-api finished clean'])
  const source = celebration[0]?.source ?? ''
  expect(source).toContain('@keyframes')
  expect(source).toContain('animation-iteration-count:1')
  expect(source).not.toContain('infinite')
  expect(animationDurations(source)).toEqual([0.6])
  expect(Math.max(...animationDelays(source)) + Math.max(...animationDurations(source))).toBeLessThanOrEqual(3)
  expect(source).toMatch(/@media \(prefers-reduced-motion: reduce\)\{[^}]*animation:none/)

  await world.clock.advance(5000)
  await world.clock.advance(2000)

  const settled = celebrationOf(await pane.drawn())
  expect(settled.map(svg => svg.alt)).toEqual(['Celebration: rate-limit-api finished clean'])
  expect(settled[0]?.source).not.toContain('@keyframes')
  expect(settled[0]?.source).not.toContain('animation')
  await pane.unmount()
})

test('the celebration settles after five seconds', async ($, on) => {
  const world = harness(on, logged(greenIntegrate, STARTED), { now: NOW })
  await world.start($)
  world.use(logged(greenIntegrate, [...STARTED, DONE], NOW + 1_000))
  await world.clock.advance(2000)
  const pane = await mountPane($, 'desktop')
  expect(celebrationOf(await pane.drawn())[0]?.source).toContain('@keyframes')

  await world.clock.advance(5000)
  await world.clock.advance(2000)

  const source = celebrationOf(await pane.drawn())[0]?.source ?? ''
  expect(source).not.toBe('')
  expect(source).not.toContain('@keyframes')
  expect(source).not.toContain('animation')
  await pane.unmount()
})

test('a run already finished at first read shows the settled celebration', async ($, on) => {
  const world = harness(on, recorded(logged(greenIntegrate, [...CLEANED, DONE])), { now: NOW })
  await world.start($)

  const tree = await desktopTree($)
  expect(textsOf(tree)).toContain('Finished clean')
  const celebration = celebrationOf(tree)
  expect(celebration.map(svg => svg.alt)).toEqual(['Celebration: rate-limit-api finished clean'])
  expect(celebration[0]?.source).not.toContain('@keyframes')
  expect(celebration[0]?.source).not.toContain('animation')
})

test('a live run draws no finish', async ($, on) => {
  const world = harness(on, logged(greenIntegrate, STARTED), { now: NOW })
  await world.start($)

  const tree = await desktopTree($)
  expect(celebrationOf(tree)).toEqual([])
  expect(textsOf(tree).filter(text => text === 'Finished clean' || text.startsWith('No celebration'))).toEqual([])
})
