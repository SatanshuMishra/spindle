import type {
  Activity,
  FileFacts,
  LaneFact,
  MspRow,
  MspStatus,
  Outcome,
  RoundActivity,
  RoundFiles,
  RoundRow,
  RoundState,
  RunIdentity,
  RunView,
  Signals,
  Stage,
} from '../../types'
import type { FileText, ReviewRound, RunFiles } from './home'
import { isObject, parseJson } from './state'
import type { Json } from './state'
import { currentActivity, plural } from './summary'
import { workersOf } from './workers'

export const STAGES: readonly Stage[] = ['spec', 'build', 'review', 'fix', 'ship', 'integrate', 'clean']

const OUTCOMES: readonly Outcome[] = ['green', 'loop', 'diagnose', 'blocked', 'hard-failure']
const FAILED_LANE = new Set(['failed', 'blocked', 'merge-blocked'])
const OPEN_STATES: ReadonlySet<RoundState> = new Set(['suite running', 'reviewing', 'validating', 'diagnosing'])
const UNSHOWN_SOURCES = new Set(['suite', 'mitosis'])
const MOST_FINDING_LINES = 3

type Parsed<T> = { kind: 'absent' } | { kind: 'bad' } | { kind: 'ok'; value: T }

type PlanMsp = { label: string }
type PlanLane = { msp: number; tier: string }
type Plan = { msps: readonly PlanMsp[]; lanes: readonly PlanLane[] }

type StateShip = { branch: string | null; pullRequest: string; isPushed: boolean }
type StateGate = { properties: readonly Json[] }
type StateMsp = { state: string | null; gate: StateGate | null; ship: StateShip | null }
type RunState = {
  lanes: Readonly<Record<string, { state: string | null }>>
  msps: Readonly<Record<string, StateMsp>>
  worktrees: readonly { branch: string; msp: number; path: string | null }[]
}

type Verdict = { outcome: Outcome; blockers: readonly string[]; advisories: readonly string[] }

type RoundRead = {
  n: number
  state: RoundState
  verdict: Verdict | null
  startedAt: number | null
  verdictAt: number | null
}

const stringOr = <T>(value: unknown, fallback: T): string | T => (typeof value === 'string' ? value : fallback)

function parsed<T>(file: FileText, shape: (value: unknown) => T | null): Parsed<T> {
  if (file.kind === 'absent') return { kind: 'absent' }
  if (file.kind === 'unreadable') return { kind: 'bad' }
  const value = shape(parseJson(file.text))
  return value === null ? { kind: 'bad' } : { kind: 'ok', value }
}

function planShape(value: unknown): Plan | null {
  if (!isObject(value) || !Array.isArray(value.msps) || !Array.isArray(value.lanes)) return null
  const msps = value.msps.map(msp => (isObject(msp) && typeof msp.label === 'string' ? { label: msp.label } : null))
  const lanes = value.lanes.map(lane =>
    isObject(lane) && typeof lane.msp === 'number' ? { msp: lane.msp, tier: stringOr(lane.tier, '') } : null,
  )
  if (msps.some(msp => msp === null) || lanes.some(lane => lane === null)) return null
  return { msps: msps as PlanMsp[], lanes: lanes as PlanLane[] }
}

function shipShape(value: unknown): StateShip | null {
  if (!isObject(value)) return null
  return {
    branch: stringOr(value.branch, null),
    pullRequest: stringOr(value.pull_request, ''),
    isPushed: value.pushed !== null && value.pushed !== undefined,
  }
}

function gateShape(value: unknown): StateGate | null {
  if (!isObject(value)) return null
  return { properties: Array.isArray(value.properties) ? value.properties.filter(isObject) : [] }
}

function stateShape(value: unknown): RunState | null {
  if (!isObject(value) || !isObject(value.lanes) || !isObject(value.msps)) return null
  if (value.worktrees !== undefined && !Array.isArray(value.worktrees)) return null
  const lanes = Object.fromEntries(
    Object.entries(value.lanes).map(([n, lane]) => [n, { state: isObject(lane) ? stringOr(lane.state, null) : null }]),
  )
  const msps = Object.fromEntries(
    Object.entries(value.msps).map(([i, msp]) => [
      i,
      isObject(msp)
        ? { state: stringOr(msp.state, null), gate: gateShape(msp.gate), ship: shipShape(msp.ship) }
        : { state: null, gate: null, ship: null },
    ]),
  )
  const worktrees = (Array.isArray(value.worktrees) ? value.worktrees : [])
    .filter(isObject)
    .filter(tree => typeof tree.branch === 'string' && typeof tree.msp === 'number')
    .map(tree => ({ branch: tree.branch as string, msp: tree.msp as number, path: stringOr(tree.path, null) }))
  return { lanes, msps, worktrees }
}

const kindOf = (finding: unknown): string =>
  typeof finding === 'string' ? finding : isObject(finding) && typeof finding.kind === 'string' ? finding.kind : 'unnamed finding'

function verdictShape(value: unknown): Verdict | null {
  if (!isObject(value) || typeof value.outcome !== 'string') return null
  if (!Array.isArray(value.blockers) || !Array.isArray(value.advisories)) return null
  const outcome = OUTCOMES.find(one => one === value.outcome) ?? 'unknown'
  return { outcome, blockers: value.blockers.map(kindOf), advisories: value.advisories.map(kindOf) }
}

function findingsShape(value: unknown): readonly string[] | null {
  if (!Array.isArray(value)) return null
  return value.map(finding => (isObject(finding) && typeof finding.source === 'string' ? finding.source : ''))
}

function candidatesOf(ledger: FileText, slug: string): ReadonlyMap<string, number> {
  const lines = (ledger.kind === 'text' ? ledger.text : '').split('\n').map(line => parseJson(line))
  return new Map(
    lines
      .filter(isObject)
      .filter(line => line.type === 'round' && line.run === slug)
      .filter(line => typeof line.round === 'number' && typeof line.msp === 'string' && typeof line.findings === 'number')
      .map(line => [`${line.round}/${line.msp}`, line.findings as number]),
  )
}

const earliestOf = (times: readonly (number | null | undefined)[]): number | null => {
  const known = times.filter((time): time is number => typeof time === 'number')
  return known.length > 0 ? Math.min(...known) : null
}

const countWords = (verdict: Verdict) =>
  `${plural(verdict.blockers.length, 'blocker')}, ${plural(verdict.advisories.length, 'advisory')}`

function findingLines(blockers: readonly string[], advisories: readonly string[]): string[] {
  const lines = [...blockers.map(kind => `${kind} (blocker)`), ...advisories.map(kind => `${kind} (advisory)`)]
  if (lines.length <= MOST_FINDING_LINES) return lines
  return [...lines.slice(0, MOST_FINDING_LINES - 1), `+${lines.length - (MOST_FINDING_LINES - 1)} more`]
}

function outcomeParts(verdict: Verdict): { outcome: string; counts: string } {
  const hasFindings = verdict.blockers.length + verdict.advisories.length > 0
  if (verdict.outcome === 'green') return { outcome: 'Green', counts: hasFindings ? countWords(verdict) : 'no findings' }
  if (verdict.outcome === 'loop') return { outcome: 'Needs fixes', counts: countWords(verdict) }
  if (verdict.outcome === 'blocked') return { outcome: 'Blocked', counts: plural(verdict.blockers.length, 'blocker') }
  if (verdict.outcome === 'diagnose') return { outcome: 'Diagnosing', counts: plural(verdict.blockers.length, 'blocker') }
  return { outcome: 'Failed', counts: '' }
}

function outcomeLine(verdict: Verdict): string {
  const { outcome, counts } = outcomeParts(verdict)
  return counts === '' ? outcome : `${outcome} · ${counts}`
}

function verdictSummary(verdict: Verdict): string[] {
  return [outcomeLine(verdict), ...findingLines(verdict.blockers, verdict.outcome === 'diagnose' ? [] : verdict.advisories)]
}

const capitalised = (words: string) => words.charAt(0).toUpperCase() + words.slice(1)

const ownFiles = (round: ReviewRound, label: string): string[] =>
  round.names.filter(name => name.startsWith(`${label}.`))

function roundRead(round: ReviewRound, label: string, verdictOf: (round: ReviewRound, label: string) => Parsed<Verdict>): RoundRead | null {
  const own = ownFiles(round, label)
  if (own.length === 0) return null
  const startedAt = earliestOf(own.map(name => round.times[name]))
  const verdictName = `${label}.verdict.json`
  const verdictAt = round.times[verdictName] ?? null
  const base = { n: round.n, startedAt, verdictAt }
  if (own.includes(verdictName)) {
    const verdict = verdictOf(round, label)
    if (verdict.kind !== 'ok' || verdict.value.outcome === 'unknown') return { ...base, state: 'status unknown', verdict: null }
    const outcome = verdict.value.outcome
    return { ...base, state: outcome === 'diagnose' ? 'diagnosing' : outcome, verdict: verdict.value }
  }
  if (own.includes(`${label}.findings.json`)) return { ...base, state: 'validating', verdict: null }
  if (own.includes(`${label}.suite.txt`)) return { ...base, state: 'reviewing', verdict: null }
  return { ...base, state: 'suite running', verdict: null }
}

function roundActivity(read: RoundRead): RoundActivity {
  const isOpen = OPEN_STATES.has(read.state)
  return {
    kind: 'round',
    round: read.n,
    name: `Round ${read.n}`,
    words: `Round ${read.n} · ${read.state}`,
    state: read.state,
    isRunning: isOpen,
    startedAt: read.state === 'diagnosing' ? (read.verdictAt ?? read.startedAt) : read.startedAt,
    summary:
      read.verdict !== null
        ? verdictSummary(read.verdict)
        : read.state === 'status unknown'
          ? ['Result unreadable']
          : [capitalised(read.state)],
    kinds: read.verdict === null ? [] : [...read.verdict.blockers, ...read.verdict.advisories],
    counts: read.verdict === null ? '' : outcomeParts(read.verdict).counts,
  }
}

function fixActivity(read: RoundRead, verdict: Verdict, isFixed: boolean): Activity {
  return {
    kind: 'fix',
    round: read.n,
    name: `Fix after round ${read.n}`,
    words: `Fix after round ${read.n}`,
    state: null,
    isRunning: !isFixed,
    startedAt: read.verdictAt,
    summary: [`Fixing ${countWords(verdict)}`, ...findingLines(verdict.blockers, [])],
    kinds: [...verdict.blockers, ...verdict.advisories],
  }
}

const shipActivity = (words: string, summary: readonly string[], kinds: readonly string[] = []): Activity => ({
  kind: 'ship',
  round: null,
  name: 'Ship',
  words: `Ship · ${words}`,
  state: null,
  isRunning: false,
  startedAt: null,
  summary,
  kinds,
})

const pullShip = (pr: string) => shipActivity(`pull request ${pr}`, [`Pull request ${pr} open`])

function shipAfter(last: RoundRead | undefined): Activity | null {
  const verdict = last?.verdict
  if (verdict === null || verdict === undefined) return null
  if (verdict.outcome === 'green') return shipActivity('waiting for pull request', ['Waiting for pull request'])
  if (verdict.outcome === 'blocked') {
    return shipActivity(
      'draft',
      [`Draft · ${plural(verdict.blockers.length, 'blocker')}`, ...findingLines(verdict.blockers, [])],
      verdict.blockers,
    )
  }
  return null
}

type BuildFacts = {
  lanes: readonly LaneFact[]
  lanesDone: number
  lanesTotal: number
  isCommitted: boolean
  proof: MspRow['proof']
  startedAt: number | null
}

function buildActivity(build: BuildFacts, hasRounds: boolean): Activity {
  const failed = build.lanes.filter(lane => lane.state === 'failed')
  const isBuilt =
    build.isCommitted || hasRounds || (build.lanesTotal > 0 && build.lanesDone === build.lanesTotal && failed.length === 0)
  const gate =
    build.proof === null
      ? []
      : [build.proof.isRedSeen && build.proof.isGreenSeen ? 'Gate passed · failed without the work, passed with it' : 'Gate inconclusive']
  const lanes = build.lanesTotal === 1 ? 'lane' : 'lanes'
  return {
    kind: 'build',
    round: null,
    name: 'Build',
    words:
      failed.length > 0 && !hasRounds
        ? 'Build · failed'
        : isBuilt
          ? 'Build · done'
          : `Build · ${build.lanesDone} of ${build.lanesTotal} ${lanes}`,
    state: null,
    isRunning: !isBuilt && failed.length === 0,
    startedAt: build.startedAt,
    summary: [`${build.lanesDone} of ${build.lanesTotal} ${lanes} done`, ...gate, ...failed.map(lane => `Lane ${lane.n} failed`)].slice(0, 4),
    kinds: [],
  }
}

const roundActivities = (reads: readonly RoundRead[]): Activity[] =>
  reads.flatMap((read, i) => {
    const isFixed = i < reads.length - 1
    return read.verdict?.outcome === 'loop' ? [roundActivity(read), fixActivity(read, read.verdict, isFixed)] : [roundActivity(read)]
  })

function activitiesOf(build: BuildFacts, reads: readonly RoundRead[], pr: string): Activity[] {
  const ship = pr !== '' ? pullShip(pr) : shipAfter(reads[reads.length - 1])
  return [buildActivity(build, reads.length > 0), ...roundActivities(reads), ...(ship === null ? [] : [ship])]
}

const withPullShip = (activities: readonly Activity[], pr: string): Activity[] => [
  ...activities.filter(activity => activity.kind !== 'ship'),
  pullShip(pr),
]

function stageOfActivity(activity: Activity | undefined): Stage | 'unknown' {
  if (activity === undefined) return 'unknown'
  if (activity.kind === 'build') return 'build'
  if (activity.kind === 'fix') return 'fix'
  if (activity.kind === 'ship') return 'ship'
  if (activity.state === 'diagnosing') return 'fix'
  if (activity.state === 'status unknown') return 'unknown'
  return 'review'
}

function statusOf(
  label: string,
  laneStates: readonly (string | null | undefined)[],
  laneOuts: readonly boolean[],
  msp: StateMsp | undefined,
  rounds: readonly ReviewRound[],
  verdictOf: (round: ReviewRound, label: string) => Parsed<Verdict>,
): { status: MspStatus; round: number } {
  const reviewed = rounds.filter(round => round.names.includes(`${label}.diff`))
  const judged = rounds.filter(round => round.verdicts[label] !== undefined)
  const reviewRound = reviewed[reviewed.length - 1]?.n ?? 0
  const latestJudged = judged[judged.length - 1]
  const round = Math.max(reviewRound, latestJudged?.n ?? 0)
  if (laneStates.some(state => typeof state === 'string' && FAILED_LANE.has(state))) return { status: 'failed', round }
  if ((msp?.ship?.pullRequest ?? '') !== '') return { status: 'pr', round }
  if (latestJudged !== undefined && latestJudged.n >= reviewRound) {
    const verdict = verdictOf(latestJudged, label)
    if (verdict.kind === 'bad') return { status: 'unknown', round }
    if (verdict.kind === 'ok') {
      const outcome = verdict.value.outcome
      if (outcome === 'green') return { status: 'green', round }
      if (outcome === 'blocked') return { status: 'blocked', round }
      if (outcome === 'loop' || outcome === 'diagnose') return { status: 'fixing', round }
    }
  }
  if (reviewRound > 0) return { status: 'review', round }
  if (msp?.state === 'committed') return { status: 'built', round }
  if (laneStates.some((state, i) => state === undefined && laneOuts[i] === true)) return { status: 'building', round }
  return { status: 'planned', round }
}

const slugOf = (words: string) => words.trim().toLowerCase().replace(/\s+/g, '-')

function diagnosisWords(slug: string, kinds: readonly string[]): string {
  return kinds.find(kind => slugOf(kind) === slug) ?? slug.replace(/-/g, ' ')
}

function roundFilesOf(round: ReviewRound, label: string, kinds: readonly string[]): RoundFiles {
  const own = ownFiles(round, label).map(name => name.slice(label.length + 1))
  const findings = parsed(round.findings[label] ?? { kind: 'absent' }, findingsShape)
  const sources = findings.kind === 'ok' ? findings.value.filter(source => source !== '' && !UNSHOWN_SOURCES.has(source)) : []
  const counted = [...new Set(sources)].map(source => ({ source, count: sources.filter(one => one === source).length }))
  return {
    n: round.n,
    msp: label,
    findingSources: findings.kind === 'bad' ? null : counted,
    candidates: findings.kind === 'ok' ? findings.value.length : null,
    diagnoses: own
      .map(name => /^(.+)\.diagnosis\.json$/.exec(name)?.[1])
      .filter((slug): slug is string => slug !== undefined)
      .map(slug => diagnosisWords(slug, kinds)),
    smokes: own
      .map(name => /^smoke-(.+)\.txt$/.exec(name)?.[1])
      .filter((platform): platform is string => platform !== undefined),
  }
}

function laneFactOf(lane: PlanLane & { n: number; hasOut: boolean }, label: string, ended: { state: string | null } | undefined): LaneFact | null {
  if (ended !== undefined) {
    const isFailed = typeof ended.state === 'string' && FAILED_LANE.has(ended.state)
    return { n: lane.n, msp: label, tier: lane.tier, state: isFailed ? 'failed' : 'done' }
  }
  return lane.hasOut ? { n: lane.n, msp: label, tier: lane.tier, state: 'building' } : null
}

export function inferFacts(files: RunFiles): FileFacts {
  const { location } = files
  const plan = parsed(files.plan, planShape)
  const state = parsed(files.state, stateShape)
  const verdictOf = (round: ReviewRound, label: string): Parsed<Verdict> =>
    parsed(round.verdicts[label] ?? { kind: 'absent' }, verdictShape)
  const lastRound = files.rounds[files.rounds.length - 1]
  const highestRound = lastRound?.n ?? 0
  const outs = new Set(files.laneNames.filter(name => name.endsWith('.out')).map(name => name.slice(0, -'.out'.length)))
  const lanes = plan.kind === 'ok' ? plan.value.lanes.map((lane, n) => ({ ...lane, n, hasOut: outs.has(String(n)) })) : []
  const runState = state.kind === 'ok' ? state.value : null
  const entryOf = (n: number) => runState?.lanes[String(n)]
  const labels = plan.kind === 'ok' ? plan.value.msps.map(msp => msp.label) : []
  const laneFacts =
    state.kind === 'bad'
      ? []
      : lanes
          .map(lane => laneFactOf(lane, labels[lane.msp] ?? '', entryOf(lane.n)))
          .filter((lane): lane is LaneFact => lane !== null && lane.msp !== '')
  const readsOf = (label: string) =>
    files.rounds.map(round => roundRead(round, label, verdictOf)).filter((read): read is RoundRead => read !== null)
  const msps = labels.map((label, i): MspRow => {
    const own = lanes.filter(lane => lane.msp === i)
    const msp = runState?.msps[String(i)]
    const tree = runState?.worktrees.find(one => one.msp === i)
    const known = statusOf(
      label,
      own.map(lane => (entryOf(lane.n) === undefined ? undefined : (entryOf(lane.n)?.state ?? null))),
      own.map(lane => lane.hasOut),
      msp,
      files.rounds,
      verdictOf,
    )
    const properties = msp?.gate?.properties ?? []
    const proof =
      msp?.gate === null || msp?.gate === undefined
        ? null
        : {
            isRedSeen: properties.some(property => property.outcome === 'pass'),
            isGreenSeen: properties.some(property => property.with_work === 0),
          }
    const lanesDone = own.filter(lane => entryOf(lane.n) !== undefined).length
    const pr = msp?.ship?.pullRequest ?? ''
    const facts = {
      label,
      branch: tree?.branch ?? `mitosis/${label}`,
      shipBranch: msp?.ship?.branch ?? null,
      lanesDone,
      lanesTotal: own.length,
      tier: own[0]?.tier ?? '',
      round: known.round,
      pr,
      proof,
    }
    if (state.kind === 'bad') {
      return { ...facts, status: 'unknown', activities: roundActivities(readsOf(label)), current: null, stage: 'unknown' }
    }
    const activities = activitiesOf(
      {
        lanes: laneFacts.filter(lane => lane.msp === label),
        lanesDone,
        lanesTotal: own.length,
        isCommitted: msp?.state === 'committed',
        proof,
        startedAt: files.planMtimeMs,
      },
      readsOf(label),
      pr,
    )
    const current = activities.length - 1
    return { ...facts, status: known.status, activities, current, stage: stageOfActivity(activities[current]) }
  })
  const building = laneFacts.filter(lane => lane.state === 'building')
  const candidates = candidatesOf(files.ledger, location.slug)
  const order = (label: string) => {
    const at = labels.indexOf(label)
    return at === -1 ? labels.length : at
  }
  const roundFiles: RoundFiles[] = files.rounds.flatMap(round =>
    labels
      .filter(label => ownFiles(round, label).length > 0)
      .map(label => {
        const verdict = verdictOf(round, label)
        return roundFilesOf(round, label, verdict.kind === 'ok' ? [...verdict.value.blockers, ...verdict.value.advisories] : [])
      }),
  )
  const rounds: RoundRow[] = files.rounds.flatMap(round =>
    Object.keys(round.verdicts)
      .sort((a, b) => order(a) - order(b) || a.localeCompare(b))
      .map(label => {
        const verdict = verdictOf(round, label)
        const listed = roundFiles.find(one => one.n === round.n && one.msp === label)?.candidates ?? null
        return {
          n: round.n,
          msp: label,
          candidates: candidates.get(`${round.n}/${label}`) ?? listed,
          blockers: verdict.kind === 'ok' ? verdict.value.blockers.length : 0,
          advisories: verdict.kind === 'ok' ? verdict.value.advisories.length : 0,
          outcome: verdict.kind === 'ok' ? verdict.value.outcome : 'unknown',
        }
      }),
  )
  const fileTimes = (files.homeEntries ?? []).filter(entry => entry.kind === 'file').map(entry => entry.mtimeMs)
  return {
    slug: location.slug,
    repo: location.repo,
    home: location.home,
    runDir: location.runDir,
    hasPlan: plan.kind,
    isStateBad: state.kind === 'bad',
    hasLighthouse: (files.homeEntries ?? []).some(entry => entry.name === 'lighthouse' && entry.kind === 'dir'),
    highestRound,
    msps,
    rounds,
    roundFiles,
    lanes: laneFacts,
    worktrees: (runState?.worktrees ?? [])
      .map(tree => ({ msp: labels[tree.msp] ?? '', path: tree.path ?? '' }))
      .filter(tree => tree.msp !== '' && tree.path !== ''),
    buildingLanes: building.length,
    buildingTier: building[0]?.tier ?? '',
    oldestMtimeMs: fileTimes.length > 0 ? Math.min(...fileTimes) : null,
  }
}

const isAtLeast = (stage: Stage | null, floor: Stage) => stage !== null && STAGES.indexOf(stage) >= STAGES.indexOf(floor)

function mspStage(msps: readonly MspRow[]): Stage | 'unknown' {
  const unshipped = msps.filter(msp => msp.pr === '')
  if (unshipped.some(msp => msp.stage === 'unknown')) return 'unknown'
  const stages = unshipped.map(msp => STAGES.indexOf(msp.stage as Stage))
  if (stages.length === 0) return msps.length === 0 ? 'build' : 'ship'
  return STAGES[Math.min(...stages)] ?? 'unknown'
}

function stageOf(files: FileFacts, msps: readonly MspRow[], signals: Signals): Stage | 'unknown' {
  const call = signals.callStage
  if (call === 'clean') return 'clean'
  if (call === 'integrate' || files.hasLighthouse) return 'integrate'
  if (files.home === null) return call === null ? 'unknown' : isAtLeast(call, 'build') ? 'build' : call
  if (files.hasPlan === 'bad') return 'unknown'
  if (files.hasPlan === 'absent') return isAtLeast(call, 'build') ? 'build' : 'spec'
  if (files.isStateBad) return 'unknown'
  return mspStage(msps)
}

function roundOf(stage: Stage | 'unknown', msps: readonly MspRow[], highestRound: number): number {
  if (stage === 'unknown') return highestRound
  if (stage !== 'review' && stage !== 'fix') return 0
  const rounds = msps
    .filter(msp => msp.pr === '' && msp.stage === stage)
    .map(msp => currentActivity(msp)?.round ?? 0)
  return rounds.length > 0 ? Math.max(...rounds) : highestRound
}

function withPull(msp: MspRow, signals: Signals): MspRow {
  if (msp.pr !== '') return msp.status === 'failed' ? msp : { ...msp, status: 'pr' }
  const pull = signals.pulls.find(one => one.head === msp.shipBranch || one.head === msp.branch)
  if (pull === undefined) return msp
  const pr = `#${pull.number}`
  const activities = withPullShip(msp.activities, pr)
  return {
    ...msp,
    pr,
    status: msp.status === 'failed' ? 'failed' : 'pr',
    activities,
    current: activities.length - 1,
    stage: 'ship',
  }
}

export const isSameRun = (one: RunIdentity, other: RunIdentity) => one.slug === other.slug && one.home === other.home

export const isRunStarted = (files: FileFacts | null, signals: Signals) =>
  signals.callStage !== null || (files?.home ?? null) !== null

export function buildView(files: FileFacts | null, signals: Signals): RunView | null {
  if (files === null || !isRunStarted(files, signals)) return null
  if (signals.finishedRun != null && isSameRun(signals.finishedRun, files)) return null
  const msps = files.msps.map(msp => withPull(msp, signals))
  const stage = stageOf(files, msps, signals)
  return {
    slug: files.slug,
    repo: files.repo,
    home: files.home,
    stage,
    round: roundOf(stage, msps, files.highestRound),
    isFinished: signals.isCleanDone,
    lane: signals.lane,
    startedAt: earliestOf([files.oldestMtimeMs, signals.firstCallAt]),
    msps,
    rounds: files.rounds,
    agents: signals.agents,
    workers: workersOf(files, msps, signals),
    buildingLanes: files.buildingLanes,
    buildingTier: files.buildingTier,
    costUsd: signals.costUsd,
    isPullRequestRunning: signals.isPullRequestRunning,
  }
}
