import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import type { Fixture, FixtureFile } from './harness'
import { harness } from './harness'
import { H, NOW, R, SF, committedMsp, endedLane, spec, stateWith } from './fixtures/runs'

const MIN = 60_000
const RECORD = '/home/owner/.mitosis/api/records/rate-limit-api'
const EVENTS = '/home/owner/.mitosis/api/events/rate-limit-api.jsonl'
const PUSHED = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

const file = (value: unknown, mtimeMs: number): FixtureFile => ({
  text: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
  mtimeMs,
})

const event = (ev: string, fields: Readonly<Record<string, unknown>> = {}) =>
  JSON.stringify({ v: 1, ev, ts: '2026-10-21T20:00:00Z', run: 'api/rate-limit-api', ...fields })

const STARTED = [
  event('run.start', { lane: 'full' }),
  event('stage.start', { stage: 'spec' }),
  event('stage.start', { stage: 'build' }),
  event('stage.start', { stage: 'ship' }),
  event('stage.start', { stage: 'integrate' }),
]
const CLEANED = [...STARTED, event('stage.start', { stage: 'clean' }), event('clean.done', { record: RECORD, kept: 0 })]

const verdict = (outcome: string, round: number) => ({
  outcome,
  round,
  blockers: outcome === 'green' ? [] : ['window resets one request early'],
  advisories: [],
  diagnose: [],
  blocked: [],
})

type RunShape = { verdicts: readonly string[]; lighthouse: readonly unknown[] }

const ONE_GREEN: RunShape = { verdicts: ['green'], lighthouse: [{ verdict: 'green' }] }

function runFiles(home: string, run: string, shape: RunShape): Record<string, FixtureFile> {
  const rounds = shape.verdicts.flatMap((outcome, i) => [
    [`${home}/review/round-${i + 1}/limiter-core.diff`, file('diff --git a/src/limiter/window.ts b/src/limiter/window.ts\n', NOW - (20 - i) * MIN)],
    [`${home}/review/round-${i + 1}/limiter-core.verdict.json`, file(verdict(outcome, i + 1), NOW - (18 - i) * MIN)],
  ])
  const lighthouse = shape.lighthouse.map((value, k) => [`${home}/lighthouse/run-${k + 1}/verdict.json`, file(value, NOW - (6 - k) * MIN)])
  return {
    [`${home}/CHARTER.md`]: file('# Charter: rate-limit-api\n', NOW - 48 * MIN),
    [`${run}/plan.json`]: file({ msps: [{ label: 'limiter-core' }], lanes: [{ msp: 0, tier: 'top' }] }, NOW - 36 * MIN),
    [`${run}/state.json`]: file(
      stateWith({ '0': endedLane(0, 0, 'ok', 30) }, { '0': committedMsp('limiter-core', '#41', PUSHED, true) }),
      NOW - 15 * MIN,
    ),
    ...Object.fromEntries(rounds),
    ...Object.fromEntries(lighthouse),
  }
}

const logOf = (lines: readonly string[]) => file(`${lines.join('\n')}\n`, NOW - 1 * MIN)

const recordRun = (shape: RunShape, lines: readonly string[]): Fixture => ({
  files: {
    [SF]: spec.files[SF] as FixtureFile,
    ...runFiles(`${RECORD}/home`, `${RECORD}/run`, shape),
    [EVENTS]: logOf(lines),
  },
})

const liveRun = (shape: RunShape, lines: readonly string[]): Fixture => ({
  files: {
    ...spec.files,
    ...runFiles(H, R, shape),
    [EVENTS]: logOf(lines),
  },
})

async function status($: Engine): Promise<string[]> {
  const answered = await $.command.run({ command: 'spindle', args: 'status' } as never)
  return String(answered.text ?? '').split('\n')
}

const finishedLine = (lines: readonly string[]) => lines.find(line => line.startsWith('stage ')) ?? ''

test('finish celebrated for closed-done with a green lighthouse verdict', async ($, on) => {
  const world = harness(on, recordRun(ONE_GREEN, [...CLEANED, event('run.end', { status: 'done' })]), { now: NOW })
  await world.start($)

  const lines = await status($)
  expect(lines).toContain('lifecycle closed-done')
  expect(lines).toContain('finish closed-done celebrated')
})

test('finish plain when the highest lighthouse run is not green', async ($, on) => {
  const shape: RunShape = { verdicts: ['green'], lighthouse: [{ verdict: 'green' }, { verdict: 'failures' }] }
  const world = harness(on, recordRun(shape, [...CLEANED, event('run.end', { status: 'done' })]), { now: NOW })
  await world.start($)

  const lines = await status($)
  expect(lines).toContain('finish closed-done plain')
  expect(lines).not.toContain('finish closed-done celebrated')
})

test('finish plain without a lighthouse verdict', async ($, on) => {
  const shape: RunShape = { verdicts: ['green'], lighthouse: [] }
  const world = harness(on, recordRun(shape, [...CLEANED, event('run.end', { status: 'done' })]), { now: NOW })
  await world.start($)

  expect(await status($)).toContain('finish closed-done plain')
})

test('finish plain for an unreadable lighthouse verdict', async ($, on) => {
  const world = harness(on, recordRun(ONE_GREEN, [...CLEANED, event('run.end', { status: 'done' })]), { now: NOW })
  world.failRead(`${RECORD}/home/lighthouse/run-1/verdict.json`, 'EIO: i/o error')
  await world.start($)

  expect(await status($)).toContain('finish closed-done plain')
})

test("finish plain when an MSP's latest verdict is blocked", async ($, on) => {
  const shape: RunShape = { verdicts: ['loop', 'blocked'], lighthouse: [{ verdict: 'green' }] }
  const world = harness(on, recordRun(shape, [...CLEANED, event('run.end', { status: 'done', draft: false })]), { now: NOW })
  await world.start($)

  const lines = await status($)
  expect(lines).toContain('lifecycle closed-done')
  expect(lines).toContain('finish closed-done plain')
})

test('finish celebrated from the run home before clean-up', async ($, on) => {
  const world = harness(on, liveRun(ONE_GREEN, [...STARTED, event('run.end', { status: 'done' })]), { now: NOW })
  await world.start($)

  const lines = await status($)
  expect(finishedLine(lines)).toContain('finished yes')
  expect(lines).toContain('finish closed-done celebrated')
})

test('closed-draft finish is plain', async ($, on) => {
  const world = harness(on, recordRun(ONE_GREEN, [...CLEANED, event('run.end', { status: 'done', draft: true })]), { now: NOW })
  await world.start($)

  const lines = await status($)
  expect(lines).toContain('lifecycle closed-draft')
  expect(lines).toContain('finish closed-draft plain')
})

test('a stopped run with its run home present is finished', async ($, on) => {
  const world = harness(on, liveRun(ONE_GREEN, [...STARTED, event('run.end', { status: 'abandoned: stopped at review: hard failure' })]), {
    now: NOW,
  })
  await world.start($)

  const lines = await status($)
  expect(finishedLine(lines)).toContain('finished yes')
  expect(lines).toContain('finish stopped-critical plain')
})

test('superseded finish is plain', async ($, on) => {
  const world = harness(on, recordRun(ONE_GREEN, [...CLEANED, event('run.end', { status: 'abandoned: superseded by rate-limit-api-2' })]), {
    now: NOW,
  })
  await world.start($)

  expect(await status($)).toContain('finish superseded plain')
})

test('cleaned finish is plain', async ($, on) => {
  const world = harness(on, recordRun(ONE_GREEN, CLEANED), { now: NOW })
  await world.start($)

  const lines = await status($)
  expect(lines).toContain('lifecycle cleaned')
  expect(lines).toContain('finish cleaned plain')
})

test('unknown finish is plain', async ($, on) => {
  const world = harness(on, recordRun(ONE_GREEN, [...CLEANED, event('run.end', { status: 'done' })]), { now: NOW })
  world.failRead(EVENTS, 'EACCES: permission denied')
  await world.start($)

  const lines = await status($)
  expect(lines).toContain('lifecycle unknown')
  expect(lines).toContain('finish unknown plain')
})

test('an abandoned end the table does not name has its own finish', async ($, on) => {
  const world = harness(on, recordRun(ONE_GREEN, [...CLEANED, event('run.end', { status: 'abandoned: owner dropped the work' })]), {
    now: NOW,
  })
  await world.start($)

  const lines = await status($)
  expect(lines).toContain('lifecycle unknown')
  expect(lines).toContain('finish abandoned plain')
})

test('a shipped run without run.end has no finish', async ($, on) => {
  const world = harness(on, liveRun(ONE_GREEN, STARTED), { now: NOW })
  await world.start($)

  const lines = await status($)
  expect(lines).toContain('lifecycle shipped')
  expect(finishedLine(lines)).toContain('finished no')
  expect(lines.filter(line => line.startsWith('finish '))).toEqual([])
})
