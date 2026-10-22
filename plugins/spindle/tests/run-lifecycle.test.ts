import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import type { Fixture, FixtureFile } from './harness'
import { harness } from './harness'
import { ANCHOR, H, NOW as RUN_NOW, R, SF, committedMsp, endedLane, integrate, review, ship, stateWith, withFile } from './fixtures/runs'

const NOW = Date.parse('2026-10-21T22:16:40Z')
const SEC = 1_000
const MITOSIS = '/home/owner/.mitosis'
const SLUG = 'spindle-visible-decorations'
const MSP = 'visible-decorations'
const RUN_HOME = `${MITOSIS}/spindle/${SLUG}`
const RUN_DIR = `${MITOSIS}/runs/spindle/${SLUG}`
const RECORD = `${MITOSIS}/spindle/records/${SLUG}`
const EVENTS = `${MITOSIS}/spindle/events/${SLUG}.jsonl`
const SESSION = `${MITOSIS}/sessions/sess-fixture.json`
const CHILD = 'spindle-wide-svg-scaling'
const CHILD_HOME = `${MITOSIS}/spindle/${CHILD}`
const CHILD_EVENTS = `${MITOSIS}/spindle/events/${CHILD}.jsonl`
const SHIP_ANCHOR = `Pipeline anchor: ${SLUG} at ${RUN_HOME}, thread ${SLUG}: SHIP=1 ${RUN_HOME}/run.zsh --resume`
const CHILD_ANCHOR = `Pipeline anchor: ${CHILD} at ${CHILD_HOME}, thread ${CHILD}: follows ${SLUG}`
const NO_RUN = 'No pipeline run in this session.'

const RECORDED_EVENTS = [
  '{"v":1,"ts":"2026-10-21T21:28:37Z","run":"spindle/spindle-visible-decorations","src":"pipeline","ev":"run.start","session":"1bb57b78-2c63-4710-ada0-0698dfc00a63","lane":"standard"}',
  '{"v":1,"ts":"2026-10-21T21:28:37Z","run":"spindle/spindle-visible-decorations","src":"pipeline","ev":"stage.start","session":"1bb57b78-2c63-4710-ada0-0698dfc00a63","stage":"spec"}',
  '{"v":1,"ts":"2026-10-21T21:40:44Z","run":"spindle/spindle-visible-decorations","src":"pipeline","ev":"stage.start","session":"1bb57b78-2c63-4710-ada0-0698dfc00a63","stage":"build"}',
  '{"v":1,"ts":"2026-10-21T21:56:37Z","run":"spindle/spindle-visible-decorations","src":"pipeline","ev":"round.verdict","session":"1bb57b78-2c63-4710-ada0-0698dfc00a63","msp":"visible-decorations","round":1,"outcome":"green","blockers":0,"advisories":1}',
  '{"v":1,"ts":"2026-10-21T21:57:29Z","run":"spindle/spindle-visible-decorations","src":"pipeline","ev":"stage.start","session":"1bb57b78-2c63-4710-ada0-0698dfc00a63","stage":"ship"}',
  '{"v":1,"ts":"2026-10-21T22:02:13Z","run":"spindle/spindle-visible-decorations","src":"pipeline","ev":"run.park","session":"1bb57b78-2c63-4710-ada0-0698dfc00a63"}',
  '{"v":1,"ts":"2026-10-21T22:07:46Z","run":"spindle/spindle-visible-decorations","src":"pipeline","ev":"stage.start","session":"1bb57b78-2c63-4710-ada0-0698dfc00a63","stage":"integrate"}',
  '{"v":1,"ts":"2026-10-21T22:11:20Z","run":"spindle/spindle-visible-decorations","src":"pipeline","ev":"run.park","session":"1bb57b78-2c63-4710-ada0-0698dfc00a63"}',
  '{"v":1,"ts":"2026-10-21T22:16:44Z","run":"spindle/spindle-visible-decorations","src":"pipeline","ev":"stage.start","session":"1bb57b78-2c63-4710-ada0-0698dfc00a63","stage":"clean"}',
]
const CLEAN_DONE = `{"v":1,"ts":"2026-10-21T22:16:51Z","run":"spindle/${SLUG}","src":"pipeline","ev":"clean.done","record":"${RECORD}","kept":0}`
const RUN_END = `{"v":1,"ts":"2026-10-21T22:16:52Z","run":"spindle/${SLUG}","src":"pipeline","ev":"run.end","status":"done","draft":false}`
const CHILD_START = `{"v":1,"ts":"2026-10-21T22:31:30Z","run":"spindle/${CHILD}","src":"pipeline","ev":"run.start","lane":"direct","follows":"${SLUG}"}`

const file = (value: unknown, mtimeMs: number): FixtureFile => ({
  text: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
  mtimeMs,
})

const session = (homes: readonly { path: string; anchor: string }[], latest: string, thread: string | null, mtimeMs: number) =>
  file({ version: 1, session_id: 'sess-fixture', thread_id: thread, run_homes: homes, latest_anchor: latest }, mtimeMs)

const plan = { msps: [{ label: MSP }], lanes: [{ msp: 0, tier: 'top' }] }
const state = {
  lanes: { '0': { state: 'ok' } },
  msps: {
    '0': {
      state: 'committed',
      gate: null,
      ship: { branch: `mitosis/${MSP}`, pull_request: '#15', pushed: '2026-10-21T22:01:50Z' },
    },
  },
  worktrees: [],
}
const verdict = { outcome: 'green', round: 1, blockers: [], advisories: ['bar texture'], diagnose: [], blocked: [] }
const lighthouse = { verdict: 'green', failures: [], unproven: [], flaky: [], tokens: 0, minutes: 4, pr: '#16' }

const homeFiles = (home: string, run: string): Record<string, FixtureFile> => ({
  [`${home}/CHARTER.md`]: file(`# Charter: ${SLUG}\n`, NOW - 48 * 60 * SEC),
  [`${home}/review/round-1/${MSP}.diff`]: file('diff', NOW - 25 * 60 * SEC),
  [`${home}/review/round-1/${MSP}.suite.txt`]: file('pass', NOW - 25 * 60 * SEC),
  [`${home}/review/round-1/${MSP}.findings.json`]: file([{ source: 'code-reviewer' }], NOW - 22 * 60 * SEC),
  [`${home}/review/round-1/${MSP}.verdict.json`]: file(verdict, NOW - 20 * 60 * SEC),
  [`${home}/lighthouse/run-1/verdict.json`]: file(lighthouse, NOW - 6 * 60 * SEC),
  [`${run}/plan.json`]: file(plan, NOW - 36 * 60 * SEC),
  [`${run}/state.json`]: file(state, NOW - 15 * 60 * SEC),
})

const events = (lines: readonly string[], mtimeMs: number) => file(`${lines.join('\n')}\n`, mtimeMs)

const live: Fixture = {
  files: {
    [SESSION]: session([{ path: RUN_HOME, anchor: SHIP_ANCHOR }], SHIP_ANCHOR, SLUG, NOW),
    [`${RUN_HOME}/run.zsh`]: file('#!/usr/bin/env zsh\n', NOW - 47 * 60 * SEC),
    ...homeFiles(RUN_HOME, RUN_DIR),
    [EVENTS]: events(RECORDED_EVENTS, NOW),
  },
}

const cleaned: Fixture = {
  files: {
    [SESSION]: session([{ path: RUN_HOME, anchor: SHIP_ANCHOR }], SHIP_ANCHOR, SLUG, NOW),
    ...homeFiles(`${RECORD}/home`, `${RECORD}/run`),
    [EVENTS]: events([...RECORDED_EVENTS, CLEAN_DONE], NOW + 11 * SEC),
  },
}

const closed: Fixture = {
  files: {
    ...cleaned.files,
    [SESSION]: session([{ path: RUN_HOME, anchor: SHIP_ANCHOR }], SHIP_ANCHOR, null, NOW + 12 * SEC),
    [EVENTS]: events([...RECORDED_EVENTS, CLEAN_DONE, RUN_END], NOW + 12 * SEC),
  },
}

const followed: Fixture = {
  files: {
    ...closed.files,
    [SESSION]: session(
      [
        { path: CHILD_HOME, anchor: CHILD_ANCHOR },
        { path: RUN_HOME, anchor: SHIP_ANCHOR },
      ],
      CHILD_ANCHOR,
      CHILD,
      NOW + 15 * 60 * SEC,
    ),
    [`${CHILD_HOME}/CHARTER.md`]: file(`# Charter: ${CHILD}\n`, NOW + 15 * 60 * SEC),
    [`${CHILD_HOME}/follows.json`]: file({ parent: SLUG, lane: 'direct' }, NOW + 15 * 60 * SEC),
    [CHILD_EVENTS]: events([CHILD_START], NOW + 15 * 60 * SEC),
  },
}

async function status($: Engine): Promise<string[]> {
  const answered = await $.command.run({ command: 'spindle', args: 'status' } as never)
  return String(answered.text ?? '').split('\n')
}

const mspLine = (lines: readonly string[]) => lines.find(line => line.startsWith(`msp ${MSP} `) && !line.includes(' now ')) ?? ''

const PANE_PROPS = { title: '', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } as const

test('replay of session 1bb57b78 keeps the run through clean-up and follows the follow-up', async ($, on) => {
  const world = harness(on, live, { now: NOW })
  world.answerBash('pipeline clean', 0)
  world.answerTool('mcp__github__create_pull_request', 'https://github.com/SatanshuMishra/spindle/pull/18')
  await world.start($, '/Users/satanshumishra/Documents/DevLabs/spindle')
  expect(await status($)).toContain(`run ${SLUG} repo spindle`)

  world.use(cleaned)
  await world.clock.advance(2000)
  await $.tool.call({ tool: 'Bash', command: `pipeline clean --repo /Users/satanshumishra/Documents/DevLabs/spindle --slug ${SLUG}` } as never)
  world.use(closed)
  await world.clock.advance(2000)

  const afterClean = await status($)
  expect(afterClean).toContain(`run ${SLUG} repo spindle`)
  expect(afterClean).toContain('lifecycle closed-done')
  expect(mspLine(afterClean)).toContain('pr #15')
  const pane = await $.ui.mount({ plugin: 'spindle', surface: 'desktop', component: 'Pane', requestId: 'spindle-run', props: PANE_PROPS })
  expect(await pane.find({ type: 'Text', text: NO_RUN })).toBeUndefined()
  await pane.unmount()

  world.use(followed)
  await world.clock.advance(2000)
  await $.tool.call({ tool: 'Bash', command: `git worktree add -b fix/${CHILD} /tmp/wide-svg` } as never)
  await $.tool.call({ tool: 'mcp__github__create_pull_request', head: `fix/${CHILD}`, base: 'main', title: 'fix(spindle): keep the bar texture, track ends and connectors full size' } as never)
  await world.clock.advance(2000)

  const afterFollowUp = await status($)
  expect(afterFollowUp).toContain(`run ${CHILD} repo spindle`)
  expect(afterFollowUp).toContain(`follows ${SLUG}`)
  expect(afterFollowUp).toContain('lifecycle shipped')
  expect(afterFollowUp).toContain(`pull #18 fix/${CHILD}`)
  expect(afterFollowUp).not.toContain(`run ${SLUG} repo spindle`)
})

test('a cleaned run is read from its run record after a restart', async ($, on) => {
  const world = harness(on, closed, { now: NOW })
  await world.start($, '/Users/satanshumishra/Documents/DevLabs/spindle')

  const lines = await status($)
  expect(lines).toContain(`run ${SLUG} repo spindle`)
  expect(lines).toContain('stage clean round 0 finished yes')
  expect(mspLine(lines)).toContain('pr #15')
  expect(lines).toContain('lifecycle closed-done')
})

const NATIVE = 'spindle-native-layout'
const NATIVE_HOME = `${MITOSIS}/spindle/${NATIVE}`
const NATIVE_ANCHOR = `Pipeline anchor: ${NATIVE} at ${NATIVE_HOME}, thread ${NATIVE}: SHIP=1 ${NATIVE_HOME}/run.zsh --resume`
const NATIVE_EVENTS = [
  '{"v":1,"ts":"2026-10-21T19:36:14Z","run":"spindle/spindle-native-layout","src":"pipeline","ev":"run.start","session":"1bb57b78-2c63-4710-ada0-0698dfc00a63","lane":"full"}',
  '{"v":1,"ts":"2026-10-21T19:36:14Z","run":"spindle/spindle-native-layout","src":"pipeline","ev":"stage.start","session":"1bb57b78-2c63-4710-ada0-0698dfc00a63","stage":"spec"}',
  '{"v":1,"ts":"2026-10-21T19:55:21Z","run":"spindle/spindle-native-layout","src":"pipeline","ev":"stage.start","session":"1bb57b78-2c63-4710-ada0-0698dfc00a63","stage":"build"}',
  '{"v":1,"ts":"2026-10-21T20:22:04Z","run":"spindle/spindle-native-layout","src":"pipeline","ev":"round.verdict","session":"1bb57b78-2c63-4710-ada0-0698dfc00a63","msp":"native-layout","round":1,"outcome":"diagnose","blockers":2,"advisories":3}',
  '{"v":1,"ts":"2026-10-21T20:28:40Z","run":"spindle/spindle-native-layout","src":"pipeline","ev":"round.verdict","session":"1bb57b78-2c63-4710-ada0-0698dfc00a63","msp":"native-layout","round":1,"outcome":"loop","blockers":2,"advisories":3}',
  '{"v":1,"ts":"2026-10-21T20:47:04Z","run":"spindle/spindle-native-layout","src":"pipeline","ev":"round.verdict","session":"1bb57b78-2c63-4710-ada0-0698dfc00a63","msp":"native-layout","round":2,"outcome":"green","blockers":0,"advisories":0}',
  '{"v":1,"ts":"2026-10-21T20:48:06Z","run":"spindle/spindle-native-layout","src":"pipeline","ev":"stage.start","session":"1bb57b78-2c63-4710-ada0-0698dfc00a63","stage":"ship"}',
  '{"v":1,"ts":"2026-10-21T20:52:13Z","run":"spindle/spindle-native-layout","src":"pipeline","ev":"run.park","session":"1bb57b78-2c63-4710-ada0-0698dfc00a63"}',
  '{"v":1,"ts":"2026-10-21T21:04:31Z","run":"spindle/spindle-native-layout","src":"pipeline","ev":"stage.start","session":"1bb57b78-2c63-4710-ada0-0698dfc00a63","stage":"integrate"}',
  '{"v":1,"ts":"2026-10-21T21:09:16Z","run":"spindle/spindle-native-layout","src":"pipeline","ev":"run.park","session":"1bb57b78-2c63-4710-ada0-0698dfc00a63"}',
  '{"v":1,"ts":"2026-10-21T21:16:19Z","run":"spindle/spindle-native-layout","src":"pipeline","ev":"stage.start","session":"1bb57b78-2c63-4710-ada0-0698dfc00a63","stage":"clean"}',
  '{"v":1,"ts":"2026-10-21T21:16:34Z","run":"spindle/spindle-native-layout","src":"pipeline","ev":"run.end","session":"1bb57b78-2c63-4710-ada0-0698dfc00a63"}',
]

const nativeLogged: Fixture = {
  files: {
    [SESSION]: session([{ path: NATIVE_HOME, anchor: NATIVE_ANCHOR }], NATIVE_ANCHOR, null, NOW),
    [`${MITOSIS}/spindle/events/${NATIVE}.jsonl`]: events(NATIVE_EVENTS, NOW),
  },
}

test('a run cleaned before run records shows from its event log', async ($, on) => {
  const world = harness(on, nativeLogged, { now: NOW })
  await world.start($, '/Users/satanshumishra/Documents/DevLabs/spindle')

  const lines = await status($)
  expect(lines).toContain(`run ${NATIVE} repo spindle`)
  expect(lines).toContain('lane full')
  expect(lines).toContain('stage clean round 0 finished yes')
  expect(lines.find(line => line.startsWith('msp native-layout ') && !line.includes(' now ')) ?? '').toContain('round 2')
  expect(lines).toContain('lifecycle closed-done')
})

const API_EVENTS = `${MITOSIS}/api/events/rate-limit-api.jsonl`
const API_RECORD = `${MITOSIS}/api/records/rate-limit-api`

const apiEvent = (ev: string, fields: Readonly<Record<string, unknown>> = {}) =>
  JSON.stringify({ v: 1, ts: '2026-10-21T20:00:00Z', run: 'api/rate-limit-api', src: 'pipeline', ev, ...fields })

const STARTED = [apiEvent('run.start', { lane: 'full' }), apiEvent('stage.start', { stage: 'spec' }), apiEvent('stage.start', { stage: 'build' })]
const SHIPPED = [
  ...STARTED,
  apiEvent('round.verdict', { msp: 'limiter-core', round: 2, outcome: 'green', blockers: 0, advisories: 0 }),
  apiEvent('stage.start', { stage: 'ship' }),
]
const CLEANED = [...SHIPPED, apiEvent('stage.start', { stage: 'clean' }), apiEvent('clean.done', { record: API_RECORD, kept: 0 })]

const logged = (base: Fixture, lines: readonly string[]): Fixture => ({ files: { ...base.files, [API_EVENTS]: events(lines, RUN_NOW) } })

const recordPath = (path: string) =>
  path.startsWith(`${H}/`) ? `${API_RECORD}/home${path.slice(H.length)}` : path.startsWith(`${R}/`) ? `${API_RECORD}/run${path.slice(R.length)}` : path

const recorded = (base: Fixture): Fixture => ({
  files: Object.fromEntries(Object.entries(base.files).map(([path, one]) => [recordPath(path), one])),
})

const pushed = (label: string, pullRequest: string) => committedMsp(label, pullRequest, '4b825dc642cb6eb9a060e54bf8d69288fbee4904', false)

const everyPullOpen = withFile(
  ship,
  `${R}/state.json`,
  stateWith(
    {
      '0': endedLane(0, 0, 'ok', 4),
      '1': endedLane(1, 0, 'ok', 3),
      '2': endedLane(2, 1, 'ok', 3),
      '3': endedLane(3, 2, 'ok', 3),
    },
    { '0': pushed('limiter-core', '#41'), '1': pushed('redis-store', '#42'), '2': pushed('headers-docs', '#43') },
  ),
  RUN_NOW - 5 * SEC,
)

const lifecycleRows: readonly { name: string; given: Fixture; expected: string }[] = [
  { name: 'lifecycle running for a run in review', given: logged(review, STARTED), expected: 'lifecycle running' },
  { name: 'lifecycle shipped once every MSP has a pull request', given: logged(everyPullOpen, SHIPPED), expected: 'lifecycle shipped' },
  {
    name: 'lifecycle reopened when a round follows ship',
    given: logged(everyPullOpen, [...SHIPPED, apiEvent('round.verdict', { msp: 'limiter-core', round: 3, outcome: 'loop', blockers: 1, advisories: 0 })]),
    expected: 'lifecycle reopened',
  },
  { name: 'lifecycle cleaned before the thread closes', given: logged(recorded(review), CLEANED), expected: 'lifecycle cleaned' },
  {
    name: 'lifecycle closed-draft from a draft end',
    given: logged(recorded(review), [...CLEANED, apiEvent('run.end', { status: 'done', draft: true })]),
    expected: 'lifecycle closed-draft',
  },
  {
    name: 'lifecycle stopped-critical from a stopped end',
    given: logged(review, [...STARTED, apiEvent('run.end', { status: 'abandoned: stopped at review: CRITICAL blocker unbounded retry' })]),
    expected: 'lifecycle stopped-critical',
  },
  {
    name: 'lifecycle superseded from a superseded end',
    given: logged(review, [...STARTED, apiEvent('run.end', { status: 'abandoned: superseded by quota-api' })]),
    expected: 'lifecycle superseded',
  },
]

for (const row of lifecycleRows) {
  test(row.name, async ($, on) => {
    const world = harness(on, row.given, { now: RUN_NOW })
    await world.start($)

    expect(await status($)).toContain(row.expected)
  })
}

const QUOTA_FIX = `${MITOSIS}/api/quota-fix`
const QUOTA_ANCHOR = `Pipeline anchor: quota-fix at ${QUOTA_FIX}, thread quota-fix: follows rate-limit-api`

const followedBy = (base: Fixture): Fixture => ({
  files: {
    ...base.files,
    [SF]: session(
      [
        { path: QUOTA_FIX, anchor: QUOTA_ANCHOR },
        { path: H, anchor: ANCHOR },
      ],
      QUOTA_ANCHOR,
      'quota-fix',
      RUN_NOW + 60_000,
    ),
    [`${QUOTA_FIX}/CHARTER.md`]: file('# Charter: quota-fix\n', RUN_NOW + 60_000),
    [`${QUOTA_FIX}/follows.json`]: file({ parent: 'rate-limit-api', lane: 'direct' }, RUN_NOW + 60_000),
  },
})

test('a follow-up registered after Done is followed without a pipeline call', async ($, on) => {
  const world = harness(on, integrate, { now: RUN_NOW })
  world.answerBash('pipeline clean', 0)
  await world.start($)
  await $.tool.call({ tool: 'Bash', command: 'pipeline clean --repo /home/owner/work/api --slug rate-limit-api' } as never)
  expect(await status($)).toContain('stage clean round 0 finished yes')

  world.use(followedBy(integrate))
  await world.clock.advance(2000)
  await world.clock.advance(2000)

  const lines = await status($)
  expect(lines).toContain('run quota-fix repo api')
  expect(lines).toContain('follows rate-limit-api')
  expect(lines).toContain('lifecycle running')
  expect(lines.filter(line => line.startsWith('stage clean'))).toEqual([])
})

test('a follow-up replaces a shipped run whose home still exists', async ($, on) => {
  const world = harness(on, ship, { now: RUN_NOW })
  await world.start($)
  expect(await status($)).toContain('run rate-limit-api repo api')

  world.use(followedBy(ship))
  await world.clock.advance(2000)

  const lines = await status($)
  expect(lines).toContain('run quota-fix repo api')
  expect(lines).toContain('follows rate-limit-api')
  expect(lines).not.toContain('run rate-limit-api repo api')
})
