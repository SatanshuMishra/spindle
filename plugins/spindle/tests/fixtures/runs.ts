import type { Fixture, FixtureFile } from '../harness'

export const NOW = 1_800_000_000_000
export const H = '/home/owner/.mitosis/api/rate-limit-api'
export const R = '/home/owner/.mitosis/runs/api/rate-limit-api'
export const L = '/home/owner/.mitosis/api/findings.jsonl'
export const SF = '/home/owner/.mitosis/sessions/sess-fixture.json'

const MIN = 60_000
const SEC = 1_000

export const ANCHOR = `Pipeline anchor: rate-limit-api at ${H}, thread rate-limit-api: ${H}/run.zsh --plan-only`
export const DECISION_ANCHOR = 'Pipeline anchor: thread rate-limit-api: recorded decision Ship rate-limit-api'

const iso = (ms: number) => new Date(ms).toISOString()

const file = (value: unknown, mtimeMs: number): FixtureFile =>
  Object.freeze({ text: typeof value === 'string' ? value : JSON.stringify(value, null, 2), mtimeMs })

const fixture = (files: Record<string, FixtureFile>): Fixture => Object.freeze({ files: Object.freeze({ ...files }) })

const sessionFile = (
  runHomes: readonly { path: string; anchor: string }[],
  latestAnchor: string | null,
  thread = 'rate-limit-api',
) => ({
  version: 1,
  session_id: 'sess-fixture',
  thread_id: thread,
  run_homes: runHomes,
  latest_anchor: latestAnchor,
})

const LABELS = ['limiter-core', 'redis-store', 'headers-docs'] as const

const plan = {
  msps: [
    {
      label: 'limiter-core',
      files: ['src/limiter/window.ts', 'src/limiter/window.test.ts'],
      steps: ['sliding-window', 'limit-middleware'],
    },
    { label: 'redis-store', files: ['src/store/redis.ts', 'src/store/redis.test.ts'], steps: ['redis-counter'] },
    { label: 'headers-docs', files: ['docs/rate-limits.md'], steps: ['limit-headers-docs'] },
  ],
  lanes: [
    { msp: 0, steps: ['sliding-window'], tier: 'top', cost: 1.2, tokens: 180000 },
    { msp: 0, steps: ['limit-middleware'], tier: 'top', cost: 0.9, tokens: 140000 },
    { msp: 1, steps: ['redis-counter'], tier: 'top', cost: 1.1, tokens: 160000 },
    { msp: 2, steps: ['limit-headers-docs'], tier: 'cheap', cost: 0.1, tokens: 40000 },
  ],
  tiers: {
    'sliding-window': 'top',
    'limit-middleware': 'top',
    'redis-counter': 'top',
    'limit-headers-docs': 'cheap',
  },
  lane_order: [0, 2, 3, 1],
  lane_after: { '1': [0] },
  plan_id: 'plan-7f3a',
  version: 2,
}

const laneEnded = (n: number, msp: number, state: string, minutesAgo: number) => ({
  lane: n,
  msp,
  state,
  exit: state === 'ok' ? 0 : 1,
  commit: state === 'ok' ? `c0ffee${n}` : null,
  started: iso(NOW - (minutesAgo + 2) * MIN),
  finished: iso(NOW - minutesAgo * MIN),
})

const worktrees = LABELS.map((label, msp) => ({
  branch: `mitosis/${label}`,
  label,
  msp,
  path: `/home/owner/.mitosis/runs/api/rate-limit-api/trees/${label}`,
}))

const shipOf = (label: string, pullRequest: string, pushed: string | null) => ({
  base: 'main',
  branch: `mitosis/${label}`,
  pull_request: pullRequest,
  pushed,
  remote: 'origin',
  unchanged: false,
})

const gate = {
  outcome: 'pass',
  counts: { pass: 1, inert: 0, inconclusive: 0, 'not-applicable': 0 },
  properties: [
    {
      step: 'sliding-window',
      file: 'src/limiter/window.test.ts',
      test: 'window rejects the eleventh request',
      outcome: 'pass',
      reason: 'failed with the work reverted, passed with it',
      with_work: 0,
      reverted: 1,
    },
  ],
}

const committed = (label: string, pullRequest: string, pushed: string | null, withGate: boolean) => ({
  state: 'committed',
  gate: withGate ? gate : null,
  reconcile: null,
  ship: shipOf(label, pullRequest, pushed),
})

const runState = (lanes: Record<string, unknown>, msps: Record<string, unknown>) => ({
  lanes,
  msps,
  worktrees,
  feature_branch: 'feature/rate-limit-api',
  started: iso(NOW - 5 * MIN),
  plan_id: 'plan-7f3a',
  version: 2,
})

const verdict = (outcome: string, round: number, blockers: readonly string[], advisories: readonly string[]) => ({
  outcome,
  round,
  blockers,
  advisories,
  diagnose: [],
  blocked: [],
})

export const spec = fixture({
  [SF]: file(sessionFile([{ path: H, anchor: ANCHOR }], ANCHOR), NOW - 48 * MIN),
  [`${H}/CHARTER.md`]: file('# Charter: rate-limit-api\n', NOW - 48 * MIN),
  [`${H}/run.zsh`]: file('#!/usr/bin/env zsh\n', NOW - 47 * MIN),
})

export const build = fixture({
  ...spec.files,
  [`${R}/plan.json`]: file(plan, NOW - 6 * MIN),
  [`${R}/state.json`]: file(runState({ '0': laneEnded(0, 0, 'ok', 4) }, {}), NOW - 4 * MIN),
  [`${R}/lanes/0.out`]: file('lane 0 output\n', NOW - 4 * MIN),
  [`${R}/lanes/0.err`]: file('', NOW - 4 * MIN),
  [`${R}/lanes/1.out`]: file('lane 1 output\n', NOW - 3 * MIN),
})

export const review = fixture({
  ...build.files,
  [`${R}/state.json`]: file(
    runState(
      {
        '0': laneEnded(0, 0, 'ok', 4),
        '1': laneEnded(1, 0, 'ok', 3),
        '2': laneEnded(2, 1, 'ok', 3),
        '3': laneEnded(3, 2, 'ok', 3),
      },
      {
        '0': committed('limiter-core', '', null, true),
        '1': committed('redis-store', '', null, false),
        '2': committed('headers-docs', '', null, false),
      },
    ),
    NOW - 150 * SEC,
  ),
  [`${R}/lanes/1.err`]: file('', NOW - 3 * MIN),
  [`${R}/lanes/2.out`]: file('lane 2 output\n', NOW - 3 * MIN),
  [`${R}/lanes/2.err`]: file('', NOW - 3 * MIN),
  [`${R}/lanes/3.out`]: file('lane 3 output\n', NOW - 3 * MIN),
  [`${R}/lanes/3.err`]: file('', NOW - 3 * MIN),
  [`${H}/review/round-1/limiter-core.diff`]: file('diff --git a/src/limiter/window.ts b/src/limiter/window.ts\n', NOW - 2 * MIN),
  [`${H}/review/round-1/redis-store.diff`]: file('diff --git a/src/store/redis.ts b/src/store/redis.ts\n', NOW - 2 * MIN),
  [`${H}/review/round-1/headers-docs.diff`]: file('diff --git a/docs/rate-limits.md b/docs/rate-limits.md\n', NOW - 2 * MIN),
})

export const fix = fixture({
  ...review.files,
  [`${H}/review/round-1/limiter-core.verdict.json`]: file(
    verdict('loop', 1, ['window resets one request early', 'limit header counts the rejected request'], [
      'name the window constant',
    ]),
    NOW - 1 * MIN,
  ),
  [`${H}/review/round-1/redis-store.verdict.json`]: file(verdict('green', 1, [], []), NOW - 1 * MIN),
  [`${H}/review/round-1/headers-docs.verdict.json`]: file(verdict('green', 1, [], []), NOW - 1 * MIN),
  [L]: file(
    [
      JSON.stringify({ type: 'round', run: 'rate-limit-api', round: 1, msp: 'limiter-core', findings: 7 }),
      JSON.stringify({ type: 'finding', run: 'rate-limit-api', round: 1, msp: 'limiter-core', id: 'F1', severity: 'blocker' }),
    ].join('\n') + '\n',
    NOW - 1 * MIN,
  ),
})

export const fixRound2 = fixture({
  ...fix.files,
  [`${H}/review/round-2/limiter-core.diff`]: file('diff --git a/src/limiter/window.ts b/src/limiter/window.ts\n', NOW - 30 * SEC),
})

export const green = fixture({
  ...fixRound2.files,
  [`${H}/review/round-2/limiter-core.verdict.json`]: file(verdict('green', 2, [], []), NOW - 20 * SEC),
})

export const ship = fixture({
  ...green.files,
  [`${R}/state.json`]: file(
    runState(
      {
        '0': laneEnded(0, 0, 'ok', 4),
        '1': laneEnded(1, 0, 'ok', 3),
        '2': laneEnded(2, 1, 'ok', 3),
        '3': laneEnded(3, 2, 'ok', 3),
      },
      {
        '0': committed('limiter-core', '#41', '4b825dc642cb6eb9a060e54bf8d69288fbee4904', true),
        '1': committed('redis-store', '', '9f2c1e0b7d4a6e3f8c5b2a1d0e9f8c7b6a5d4e3f', false),
        '2': committed('headers-docs', '', '1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d', false),
      },
    ),
    NOW - 10 * SEC,
  ),
})

export const integrate = fixture({
  ...ship.files,
  [`${H}/lighthouse/run-1/verdict.json`]: file(
    { verdict: 'pass', failures: [], unproven: [], flaky: [], tokens: 0, minutes: 3, pr: '' },
    NOW - 5 * SEC,
  ),
})

const SPLIT_OLD = '/home/owner/.mitosis/api/old-run'
const SPLIT_HOME = '/home/owner/.mitosis/field-notes/rate-limit-api'
const SPLIT_RUN = '/home/owner/.mitosis/runs/field-notes/rate-limit-api'
const SPLIT_ANCHOR = `Pipeline anchor: rate-limit-api at ${SPLIT_HOME}, thread rate-limit-api: ${SPLIT_HOME}/run.zsh --plan-only`

export const split = fixture({
  [SF]: file(
    sessionFile(
      [
        { path: SPLIT_HOME, anchor: SPLIT_ANCHOR },
        { path: SPLIT_OLD, anchor: `Pipeline anchor: old-run at ${SPLIT_OLD}, thread old-run: ${SPLIT_OLD}/run.zsh --plan-only` },
      ],
      SPLIT_ANCHOR,
    ),
    NOW - 48 * MIN,
  ),
  [`${SPLIT_HOME}/CHARTER.md`]: file('# Charter: rate-limit-api\n', NOW - 48 * MIN),
  [`${SPLIT_HOME}/run.zsh`]: file('#!/usr/bin/env zsh\n', NOW - 47 * MIN),
  [`${SPLIT_RUN}/plan.json`]: file(plan, NOW - 6 * MIN),
  [`${SPLIT_RUN}/state.json`]: file(runState({ '0': laneEnded(0, 0, 'ok', 4) }, {}), NOW - 4 * MIN),
})

export const decisionAnchor = fixture({
  ...review.files,
  [SF]: file(sessionFile([{ path: H, anchor: ANCHOR }], DECISION_ANCHOR), NOW - 2 * MIN),
})

export const threadOnly = fixture({
  [SF]: file(sessionFile([], null), NOW - 48 * MIN),
})

const QUOTA_HOME = '/home/owner/.mitosis/api/quota-api'
const QUOTA_ANCHOR = `Pipeline anchor: quota-api at ${QUOTA_HOME}, thread quota-api: ${QUOTA_HOME}/run.zsh --plan-only`

export const secondRun = fixture({
  ...integrate.files,
  [SF]: file(
    sessionFile(
      [
        { path: QUOTA_HOME, anchor: QUOTA_ANCHOR },
        { path: H, anchor: ANCHOR },
      ],
      'Pipeline anchor: thread quota-api: recorded decision Amendment hand-off',
      'quota-api',
    ),
    NOW - 1 * MIN,
  ),
  [`${QUOTA_HOME}/CHARTER.md`]: file('# Charter: quota-api\n', NOW - 1 * MIN),
  [`${QUOTA_HOME}/run.zsh`]: file('#!/usr/bin/env zsh\n', NOW - 1 * MIN),
})

export const otherThread = fixture({
  [SF]: file(sessionFile([{ path: H, anchor: ANCHOR }], ANCHOR, 'quota-api'), NOW - 48 * MIN),
})

export const withFile = (base: Fixture, path: string, value: unknown, mtimeMs: number): Fixture =>
  fixture({ ...base.files, [path]: file(value, mtimeMs) })

export const stateWith = (lanes: Record<string, unknown>, msps: Record<string, unknown>) => runState(lanes, msps)

export const endedLane = laneEnded
