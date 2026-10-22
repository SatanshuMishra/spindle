import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import type { Fixture, FixtureFile } from './harness'
import { harness } from './harness'
import { NOW, SF, committedMsp, endedLane, fix, review } from './fixtures/runs'

const MIN = 60_000
const MITOSIS = '/home/owner/.mitosis'
const RECORDS = `${MITOSIS}/api/records`
const PAST = 'limits-v1'
const PAST_RECORD = `${RECORDS}/${PAST}`
const PAST_EVENTS = `${MITOSIS}/api/events/${PAST}.jsonl`
const PAST_AT = NOW - 2 * MIN
const GONE = `${MITOSIS}/api/gone-run`
const GONE_ANCHOR = `Pipeline anchor: gone-run at ${GONE}, thread gone-run: ${GONE}/run.zsh --resume`
const NO_RUN = 'No pipeline run in this session.'
const BACK = "Back to this session's run"

const paneProps = (bodyColumns: number) =>
  ({ title: '', isFocused: false, bodyColumns, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} }) as const

const mountPane = ($: Engine, surface: 'desktop' | 'terminal' = 'desktop') =>
  $.ui.mount({ plugin: 'spindle', surface, component: 'Pane', requestId: 'spindle-run', props: paneProps(100) })

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

const keyOf = (node: Drawn) => String(node.props?.key ?? '')

const textsOf = (tree: unknown) => nodesOf(tree).filter(node => node.type === 'Text').map(textOf)

const buttonsOf = (tree: unknown) =>
  nodesOf(tree)
    .filter(node => node.type === 'Button')
    .map(node => ({ key: keyOf(node), text: String(node.props?.label ?? '') }))

const pastButtons = (tree: unknown) => buttonsOf(tree).filter(button => button.key.startsWith('past-') && button.key !== 'past-back')

const svgsOf = (tree: unknown) =>
  nodesOf(tree)
    .filter(node => node.type === 'Svg')
    .map(node => ({ alt: String(node.props?.alt ?? ''), source: String(node.props?.source ?? '') }))

const tileText = (tree: unknown, key: string) => textsOf(nodesOf(tree).find(node => keyOf(node) === key))

const file = (value: unknown, mtimeMs: number): FixtureFile => ({
  text: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
  mtimeMs,
})

const plainRecord = (slug: string, minutesAgo: number): Record<string, FixtureFile> => ({
  [`${RECORDS}/${slug}/home/CHARTER.md`]: file(`# Charter: ${slug}\n`, NOW - minutesAgo * MIN),
})

const verdict = (round: number) => ({ outcome: 'green', round, blockers: [], advisories: [], diagnose: [], blocked: [] })

const event = (ev: string, fields: Readonly<Record<string, unknown>> = {}) =>
  JSON.stringify({ v: 1, ev, ts: '2026-10-21T20:00:00Z', run: `api/${PAST}`, ...fields })

const PAST_LINES = [
  event('run.start', { lane: 'full' }),
  event('stage.start', { stage: 'spec' }),
  event('stage.start', { stage: 'build' }),
  event('round.verdict', { msp: 'limiter-core', round: 1, outcome: 'green', blockers: 0, advisories: 0 }),
  event('round.verdict', { msp: 'headers-docs', round: 1, outcome: 'green', blockers: 0, advisories: 0 }),
  event('stage.start', { stage: 'ship' }),
  event('stage.start', { stage: 'integrate' }),
  event('stage.start', { stage: 'clean' }),
  event('clean.done', { record: PAST_RECORD, kept: 0 }),
  event('run.end', { status: 'done', draft: false }),
]

const celebratedRecord: Record<string, FixtureFile> = {
  [`${PAST_RECORD}/home/CHARTER.md`]: file(`# Charter: ${PAST}\n`, PAST_AT - 40 * MIN),
  [`${PAST_RECORD}/home/review/round-1/limiter-core.diff`]: file('diff', PAST_AT - 20 * MIN),
  [`${PAST_RECORD}/home/review/round-1/limiter-core.verdict.json`]: file(verdict(1), PAST_AT - 18 * MIN),
  [`${PAST_RECORD}/home/review/round-1/headers-docs.diff`]: file('diff', PAST_AT - 20 * MIN),
  [`${PAST_RECORD}/home/review/round-1/headers-docs.verdict.json`]: file(verdict(1), PAST_AT - 18 * MIN),
  [`${PAST_RECORD}/home/lighthouse/run-1/verdict.json`]: file({ verdict: 'green' }, PAST_AT - 5 * MIN),
  [`${PAST_RECORD}/run/plan.json`]: file(
    {
      msps: [{ label: 'limiter-core' }, { label: 'headers-docs' }],
      lanes: [
        { msp: 0, tier: 'top' },
        { msp: 1, tier: 'cheap' },
      ],
    },
    PAST_AT - 35 * MIN,
  ),
  [`${PAST_RECORD}/run/state.json`]: file(
    {
      lanes: { '0': endedLane(0, 0, 'ok', 30), '1': endedLane(1, 1, 'ok', 29) },
      msps: {
        '0': committedMsp('limiter-core', '#31', '4b825dc642cb6eb9a060e54bf8d69288fbee4904', true),
        '1': committedMsp('headers-docs', '#32', '9f2c1e0b7d4a6e3f8c5b2a1d0e9f8c7b6a5d4e3f', false),
      },
      worktrees: [],
    },
    PAST_AT,
  ),
  [PAST_EVENTS]: file(`${PAST_LINES.join('\n')}\n`, PAST_AT),
}

const OTHERS: readonly (readonly [string, number])[] = [
  ['quota-api', 9],
  ['billing-export', 11],
  ['cache-warmup', 4],
  ['docs-refresh', 7],
  ['error-pages', 1],
  ['feature-flags', 10],
  ['geo-routing', 5],
  ['health-checks', 3],
  ['image-resize', 8],
  ['job-queue', 6],
]

const twelveRecords: Record<string, FixtureFile> = {
  ...plainRecord('rate-limit-api', 0),
  ...celebratedRecord,
  ...Object.assign({}, ...OTHERS.map(([slug, minutesAgo]) => plainRecord(slug, minutesAgo))),
}

const withRecords = (base: Fixture, records: Record<string, FixtureFile>): Fixture => ({ files: { ...base.files, ...records } })

const liveWithPast = withRecords(review, twelveRecords)

const twoRecords: Record<string, FixtureFile> = { ...plainRecord('quota-api', 9), ...plainRecord('cache-warmup', 4) }

const goneSession: Fixture = {
  files: {
    [SF]: file(
      { version: 1, session_id: 'sess-fixture', thread_id: 'gone-run', run_homes: [{ path: GONE, anchor: GONE_ANCHOR }], latest_anchor: GONE_ANCHOR },
      NOW - 10 * MIN,
    ),
    ...twoRecords,
  },
}

test('past runs list newest first, at most ten', async ($, on) => {
  const world = harness(on, liveWithPast, { now: NOW })
  await world.start($)

  const pane = await mountPane($)
  const tree = await pane.drawn()
  await pane.unmount()

  expect(textsOf(tree)).toContain('Past runs · 10')
  expect(pastButtons(tree).map(button => button.text)).toEqual([
    'error-pages',
    PAST,
    'health-checks',
    'cache-warmup',
    'geo-routing',
    'job-queue',
    'docs-refresh',
    'image-resize',
    'quota-api',
    'feature-flags',
  ])
})

test('selecting a past run shows it read-only', async ($, on) => {
  const world = harness(on, liveWithPast, { now: NOW })
  await world.start($)

  const pane = await mountPane($)
  await pane.press({ key: `past-${PAST}` })
  const tree = await pane.drawn()
  await pane.unmount()

  const texts = textsOf(tree)
  expect(texts).toContain(PAST)
  expect(texts).not.toContain('rate-limit-api')
  expect(buttonsOf(tree).map(button => button.key)).toEqual(expect.arrayContaining(['msp-limiter-core', 'msp-headers-docs']))
  expect(svgsOf(tree).filter(svg => /^(Spec|Build|Review|Fix|Ship|Integrate|Clean-up): /.test(svg.alt)).length).toBe(7)
  const celebration = svgsOf(tree).filter(svg => svg.alt.startsWith('Celebration'))
  expect(celebration.map(svg => svg.alt)).toEqual([`Celebration: ${PAST} finished clean`])
  expect(celebration[0]?.source).not.toContain('animation')
  expect(tileText(tree, 'tile-cost')).toContain('not kept')
  expect(buttonsOf(tree).find(button => button.key === 'past-back')?.text).toBe(BACK)
  expect(world.writes()).toEqual([])
})

test("back returns to the session's run", async ($, on) => {
  const world = harness(on, liveWithPast, { now: NOW })
  await world.start($)

  const pane = await mountPane($)
  await pane.press({ key: `past-${PAST}` })
  await pane.press({ key: 'past-back' })
  const tree = await pane.drawn()
  await pane.unmount()

  const texts = textsOf(tree)
  expect(texts).toContain('rate-limit-api')
  expect(texts).not.toContain(PAST)
  expect(buttonsOf(tree).find(button => button.key === 'past-back')).toBeUndefined()
})

test("a session whose run left no files still lists its repo's past runs", async ($, on) => {
  const world = harness(on, goneSession, { now: NOW })
  await world.start($)

  const pane = await mountPane($)
  const texts = textsOf(await pane.drawn())
  await pane.unmount()

  expect(texts).toContain(NO_RUN)
  expect(texts).toContain('Past runs · 2')
})

test('an unlistable records folder shows no past runs until it can be listed', async ($, on) => {
  const world = harness(on, withRecords(review, twoRecords), { now: NOW })
  world.failList(RECORDS, 'EACCES: permission denied')
  await world.start($)

  const pane = await mountPane($)
  const before = textsOf(await pane.drawn())
  expect(before.filter(text => text.startsWith('Past runs'))).toEqual([])
  expect(before).toContain('rate-limit-api')

  world.liftList(RECORDS)
  await world.clock.advance(2000)

  expect(textsOf(await pane.drawn())).toContain('Past runs · 2')
  await pane.unmount()
})

test('an MSP selected in a past run stays selected across polls', async ($, on) => {
  const world = harness(on, liveWithPast, { now: NOW })
  await world.start($)

  const pane = await mountPane($)
  await pane.press({ key: `past-${PAST}` })
  await pane.press({ key: 'msp-limiter-core' })

  world.use(withRecords(fix, twelveRecords))
  await world.clock.advance(2000)
  const texts = textsOf(await pane.drawn())
  await pane.unmount()

  expect(texts).toContain(PAST)
  expect(texts).toContain('limiter-core · workers')
  expect(texts).toContain('Working · 0')
  expect(texts.filter(text => text.startsWith('Done · '))).toHaveLength(1)
})
