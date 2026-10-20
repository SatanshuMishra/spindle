import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { FH, H, NOW, R, build, committedMsp, endedLane, fireplace, fix, stateWith, withFile } from './fixtures/runs'
import type { Fixture } from './harness'
import { harness } from './harness'

const MIN = 60_000
const ROUND_2 = `${H}/review/round-2`

async function status($: Engine): Promise<string[]> {
  const answered = await $.command.run({ command: 'spindle', args: 'status' } as never)
  return String(answered.text ?? '').split('\n')
}

const lineStarting = (lines: readonly string[], start: string) => lines.find(line => line.startsWith(start)) ?? ''

const roundSummary = (lines: readonly string[], label: string, round: number) => {
  const line = lineStarting(lines, `activity ${label} Round ${round}: `)
  return line === '' ? [] : line.slice(`activity ${label} Round ${round}: `.length).split(' / ')
}

const activityNames = (lines: readonly string[], label: string) =>
  lines
    .filter(line => line.startsWith(`activity ${label} `))
    .map(line => line.slice(`activity ${label} `.length).split(': ')[0])
    .join(', ')

const verdictWith = (outcome: string, round: number, blockers: readonly string[], advisories: readonly string[]) => ({
  outcome,
  round,
  blockers: blockers.map((kind, i) => ({ id: `B${i + 1}`, severity: 'blocker', kind, location: 'src/limiter/window.ts:12', summary: kind })),
  advisories: advisories.map((kind, i) => ({ id: `A${i + 1}`, severity: 'advisory', kind, location: 'src/limiter/window.ts:30', summary: kind })),
  diagnose: [],
  blocked: [],
})

async function statusOf($: Engine, on: Parameters<typeof harness>[0], fixture: Fixture) {
  const world = harness(on, fixture, { now: NOW })
  await world.start($)
  return status($)
}

test('a ship call while one MSP is in round 5 keeps the run at Review', async ($, on) => {
  const world = harness(on, fireplace, { now: NOW })
  await world.start($)

  await $.tool.call({ tool: 'Bash', command: `SHIP=1 ${FH}/run.zsh --resume` } as never)

  const lines = await status($)
  expect(lines.some(line => line.startsWith('stage review'))).toBe(true)
})

test("one MSP with a pull request does not move the run past another MSP's fix", async ($, on) => {
  const pushed = withFile(
    fix,
    `${R}/state.json`,
    stateWith(
      {
        '0': endedLane(0, 0, 'ok', 4),
        '1': endedLane(1, 0, 'ok', 3),
        '2': endedLane(2, 1, 'ok', 3),
        '3': endedLane(3, 2, 'ok', 3),
      },
      {
        '0': committedMsp('limiter-core', '', null, true),
        '1': committedMsp('redis-store', '#42', '9f2c1e0b7d4a6e3f8c5b2a1d0e9f8c7b6a5d4e3f', false),
        '2': committedMsp('headers-docs', '', null, false),
      },
    ),
    NOW - 30_000,
  )

  const lines = await statusOf($, on, pushed)

  expect(lines.some(line => line.startsWith('stage fix'))).toBe(true)
  expect(lines.some(line => line.startsWith('stage ship'))).toBe(false)
})

test("the fireplace-shaped run shows each MSP's current activity", async ($, on) => {
  const lines = await statusOf($, on, fireplace)

  expect(lineStarting(lines, 'msp mic-recovery now Ship · pull request #329')).not.toBe('')
  expect(lineStarting(lines, 'msp hearing-and-ring now Ship · waiting for pull request')).not.toBe('')
  expect(lineStarting(lines, 'msp video-starts-like-a-camera now Round 5 · suite running')).not.toBe('')
  expect(lineStarting(lines, 'msp button-consistency now Round 4 · diagnosing')).not.toBe('')
})

test('a loop verdict with no next round is Fix after that round', async ($, on) => {
  const lines = await statusOf($, on, fix)

  expect(lineStarting(lines, 'msp limiter-core now Fix after round 1')).not.toBe('')
  expect(activityNames(lines, 'limiter-core')).toBe('Build, Round 1, Fix after round 1')
})

test('a building MSP counts its lanes', async ($, on) => {
  const lines = await statusOf($, on, build)

  expect(lineStarting(lines, 'msp limiter-core now Build · 1 of 2 lanes')).not.toBe('')
})

test('round state follows the defined files', async ($, on) => {
  const suiteRun = withFile(fix, `${ROUND_2}/limiter-core.suite.run`, 'suite started\n', NOW - 40_000)
  const suiteText = withFile(suiteRun, `${ROUND_2}/limiter-core.suite.txt`, 'all tests passed\n', NOW - 30_000)
  const findings = withFile(suiteText, `${ROUND_2}/limiter-core.findings.json`, [], NOW - 20_000)
  const diagnose = withFile(findings, `${ROUND_2}/limiter-core.verdict.json`, verdictWith('diagnose', 2, ['window resets one request early'], []), NOW - 10_000)
  const loop = withFile(findings, `${ROUND_2}/limiter-core.verdict.json`, verdictWith('loop', 2, ['window resets one request early'], []), NOW - 5_000)
  const world = harness(on, suiteRun, { now: NOW })
  await world.start($)

  const read: string[] = []
  for (const fixture of [suiteRun, suiteText, findings, diagnose, loop]) {
    world.use(fixture)
    await world.clock.advance(2000)
    read.push(lineStarting(await status($), 'msp limiter-core now '))
  }

  expect(read[0]?.startsWith('msp limiter-core now Round 2 · suite running')).toBe(true)
  expect(read[1]?.startsWith('msp limiter-core now Round 2 · reviewing')).toBe(true)
  expect(read[2]?.startsWith('msp limiter-core now Round 2 · validating')).toBe(true)
  expect(read[3]?.startsWith('msp limiter-core now Round 2 · diagnosing')).toBe(true)
  expect(read[4]?.startsWith('msp limiter-core now Fix after round 2')).toBe(true)
})

test('a loop verdict summarises its finding kinds', async ($, on) => {
  const lines = await statusOf($, on, fireplace)

  expect(roundSummary(lines, 'video-starts-like-a-camera', 4)).toEqual([
    'Needs fixes · 1 blocker, 1 advisory',
    'take lost on sound failure (blocker)',
    'data clumps (advisory)',
  ])
})

test('a green verdict says no findings', async ($, on) => {
  const lines = await statusOf($, on, fireplace)

  expect(roundSummary(lines, 'video-starts-like-a-camera', 3)).toEqual(['Green · no findings'])
})

test('five findings fold into plus more', async ($, on) => {
  const five = withFile(fix, `${H}/review/round-1/limiter-core.verdict.json`, verdictWith('loop', 1, ['k1', 'k2', 'k3', 'k4'], ['k5']), NOW - MIN)

  const lines = await statusOf($, on, five)

  expect(roundSummary(lines, 'limiter-core', 1)).toEqual(['Needs fixes · 4 blockers, 1 advisory', 'k1 (blocker)', 'k2 (blocker)', '+3 more'])
})

test('a blocked verdict names its blockers', async ($, on) => {
  const blocked = withFile(fix, `${H}/review/round-1/limiter-core.verdict.json`, verdictWith('blocked', 1, ['small tap target'], []), NOW - MIN)

  const lines = await statusOf($, on, blocked)

  expect(roundSummary(lines, 'limiter-core', 1)).toEqual(['Blocked · 1 blocker', 'small tap target (blocker)'])
})

test('open and diagnosing rounds have summaries', async ($, on) => {
  const lines = await statusOf($, on, fireplace)

  expect(roundSummary(lines, 'video-starts-like-a-camera', 5).join(' / ')).toBe('Suite running · 7m')
  expect(roundSummary(lines, 'button-consistency', 4).join(' / ')).toBe('Diagnosing · 1 blocker / hand-built tap target (blocker)')
})

test('an unreadable verdict is status unknown', async ($, on) => {
  const unreadable = withFile(fix, `${ROUND_2}/limiter-core.verdict.json`, 'not json', NOW - 30_000)

  const lines = await statusOf($, on, unreadable)

  expect(lines).toContain('msp limiter-core now Round 2 · status unknown')
  expect(roundSummary(lines, 'limiter-core', 2)).toEqual(['Result unreadable'])
})

test('an unknown outcome is status unknown', async ($, on) => {
  const paused = withFile(fix, `${ROUND_2}/limiter-core.verdict.json`, verdictWith('paused', 2, [], []), NOW - 30_000)

  const lines = await statusOf($, on, paused)

  expect(lines).toContain('msp limiter-core now Round 2 · status unknown')
})

test('a round started seven minutes ago shows 7m', async ($, on) => {
  const lines = await statusOf($, on, fireplace)

  expect(lines).toContain('msp video-starts-like-a-camera now Round 5 · suite running · 7m')
})

test('a fix shows the time since its verdict', async ($, on) => {
  const lines = await statusOf($, on, fix)

  expect(lines).toContain('msp limiter-core now Fix after round 1 · 1m')
})
