import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import type { Fixture, FixtureFile } from './harness'
import { harness } from './harness'
import { H, NOW, R, SF, review, withFile } from './fixtures/runs'

const LIMITER_TREE = '/home/owner/.mitosis/runs/api/rate-limit-api/trees/limiter-core'
const RECORD = '/home/owner/.mitosis/api/records/rate-limit-api'
const EVENTS = '/home/owner/.mitosis/api/events/rate-limit-api.jsonl'

async function status($: Engine): Promise<string[]> {
  const answered = await $.command.run({ command: 'spindle', args: 'status' } as never)
  return String(answered.text ?? '').split('\n')
}

const spawn = ($: Engine, subagentType: string, prompt: string, description: string) =>
  $.agent.spawn({
    tool_use_id: `tool-${description}`,
    prompt,
    description,
    subagentType,
    provider: 'engine',
    parentModel: 'claude-opus-5-5',
    background: false,
    fork: false,
  } as never)

const complete = ($: Engine, agentId: string) =>
  ($.turn.complete as (e: unknown) => Promise<unknown>)({
    agentId,
    reason: 'answer',
    answer: 'ok',
    turnId: `turn-${agentId}`,
    durationMs: 1000,
    isAborted: false,
  })

const answerTurns = (on: On) => on('turn.complete', () => ({ text: '' }) as never)

const workerLines = (lines: readonly string[], prefix: string) => lines.filter(line => line.startsWith(prefix))

test("a brief's msp line puts the agent under that MSP", async ($, on) => {
  const world = harness(on, review, { now: NOW })
  world.queueSpawn({ agentId: 'a-review', model: 'claude-opus-5-5' })
  await world.start($)

  await spawn($, 'code-reviewer', 'msp: redis-store\nCompare this diff with the limiter-core window rules.', 'review the store')

  const lines = await status($)
  expect(workerLines(lines, 'worker redis-store detective ').filter(line => line.endsWith('· live'))).toHaveLength(1)
  expect(workerLines(lines, 'worker limiter-core detective ')).toEqual([])
})

test('a finished agent stays under its MSP', async ($, on) => {
  answerTurns(on)
  const world = harness(on, review, { now: NOW })
  world.queueSpawn({ agentId: 'a-check', model: 'claude-opus-5-5' })
  await world.start($)
  await spawn($, 'general-purpose', `Run the suite in ${LIMITER_TREE} and report.`, 'check the worktree')

  await complete($, 'a-check')

  const lines = await status($)
  expect(lines).toContain('worker limiter-core plain check the worktree · done')
})

test('a finished reviewer keeps its round after the next round starts', async ($, on) => {
  answerTurns(on)
  const world = harness(on, review, { now: NOW })
  world.queueSpawn({ agentId: 'a-review', model: 'claude-opus-5-5' })
  await world.start($)
  await spawn($, 'code-reviewer', `Review round 1 of the diff in ${LIMITER_TREE}.`, 'review the limiter')
  await complete($, 'a-review')

  const withoutRound1 = Object.fromEntries(
    Object.entries(review.files).filter(([path]) => path !== `${H}/review/round-1/limiter-core.diff`),
  )
  world.use(withFile({ files: withoutRound1 }, `${H}/review/round-2/limiter-core.diff`, 'diff --git a/src/limiter/window.ts\n', NOW))
  await world.clock.advance(2000)

  const lines = workerLines(await status($), 'worker limiter-core detective ')
  expect(lines.filter(line => line.startsWith('worker limiter-core detective Round 1') && line.endsWith('done'))).toEqual([
    'worker limiter-core detective Round 1 · reviewed · done',
  ])
})

const recordPath = (path: string) =>
  path.startsWith(`${H}/`) ? `${RECORD}/home${path.slice(H.length)}` : path.startsWith(`${R}/`) ? `${RECORD}/run${path.slice(R.length)}` : path

const event = (ev: string, fields: Readonly<Record<string, unknown>> = {}) =>
  JSON.stringify({ v: 1, ev, ts: '2026-10-21T20:00:00Z', run: 'api/rate-limit-api', ...fields })

const closedRecord: Fixture = {
  files: {
    ...Object.fromEntries(Object.entries(review.files).map(([path, one]) => [recordPath(path), one])),
    [SF]: review.files[SF] as FixtureFile,
    [EVENTS]: {
      text: `${[event('run.start', { lane: 'full' }), event('clean.done', { record: RECORD }), event('run.end', { status: 'done' })].join('\n')}\n`,
      mtimeMs: NOW,
    },
  },
}

test('a finished run lists no main-thread worker', async ($, on) => {
  const world = harness(on, closedRecord, { now: NOW })
  await world.start($)

  const lines = await status($)
  expect(lines).toContain('lifecycle closed-done')
  expect(lines.filter(line => line.startsWith('worker - captain'))).toEqual([])
})
