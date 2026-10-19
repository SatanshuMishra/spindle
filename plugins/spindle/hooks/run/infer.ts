import type { FileFacts, MspRow, MspStatus, Outcome, RoundRow, RunView, Signals, Stage } from '../../types'
import type { FileText, ReviewRound, RunFiles } from './home'
import { isObject, parseJson } from './state'
import type { Json } from './state'

export const STAGES: readonly Stage[] = ['spec', 'build', 'review', 'fix', 'ship', 'integrate', 'clean']

const OUTCOMES: readonly Outcome[] = ['green', 'loop', 'diagnose', 'blocked', 'hard-failure']
const FAILED_LANE = new Set(['failed', 'blocked', 'merge-blocked'])

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
  worktrees: readonly { branch: string; msp: number }[]
}

type Verdict = { outcome: Outcome; blockers: number; advisories: number }

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
    .map(tree => ({ branch: tree.branch as string, msp: tree.msp as number }))
  return { lanes, msps, worktrees }
}

function verdictShape(value: unknown): Verdict | null {
  if (!isObject(value) || typeof value.outcome !== 'string') return null
  if (!Array.isArray(value.blockers) || !Array.isArray(value.advisories)) return null
  const outcome = OUTCOMES.find(one => one === value.outcome) ?? 'unknown'
  return { outcome, blockers: value.blockers.length, advisories: value.advisories.length }
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

const laterOf = (a: Stage, b: Stage): Stage => (STAGES.indexOf(a) >= STAGES.indexOf(b) ? a : b)

type Rule = 'match' | 'none' | 'unknown'

function fileStageOf(
  files: RunFiles,
  plan: Parsed<Plan>,
  state: Parsed<RunState>,
  verdicts: readonly Parsed<Verdict>[],
): Stage | 'unknown' | null {
  if (files.location.home === null) return null
  const hasLighthouse = (files.homeEntries ?? []).some(entry => entry.name === 'lighthouse' && entry.kind === 'dir')
  const fix: Rule = verdicts.some(v => v.kind === 'ok' && (v.value.outcome === 'loop' || v.value.outcome === 'diagnose'))
    ? 'match'
    : verdicts.some(v => v.kind === 'bad')
      ? 'unknown'
      : 'none'
  const ship: Rule =
    state.kind === 'bad'
      ? 'unknown'
      : state.kind === 'ok' && Object.values(state.value.msps).some(msp => msp.ship?.isPushed === true)
        ? 'match'
        : 'none'
  const rules: readonly (readonly [Stage, Rule])[] = [
    ['spec', 'match'],
    ['build', plan.kind === 'absent' ? 'none' : plan.kind === 'bad' ? 'unknown' : 'match'],
    ['review', files.rounds.length > 0 ? 'match' : 'none'],
    ['fix', fix],
    ['ship', ship],
    ['integrate', hasLighthouse ? 'match' : 'none'],
  ]
  const latest = [...rules].reverse().find(([, rule]) => rule !== 'none')
  return latest === undefined ? 'spec' : latest[1] === 'match' ? latest[0] : 'unknown'
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

export function inferFacts(files: RunFiles): FileFacts {
  const { location } = files
  const plan = parsed(files.plan, planShape)
  const state = parsed(files.state, stateShape)
  const verdictOf = (round: ReviewRound, label: string): Parsed<Verdict> =>
    parsed(round.verdicts[label] ?? { kind: 'absent' }, verdictShape)
  const lastRound = files.rounds[files.rounds.length - 1]
  const latestVerdicts = lastRound ? Object.keys(lastRound.verdicts).map(label => verdictOf(lastRound, label)) : []
  const fileStage = fileStageOf(files, plan, state, latestVerdicts)
  const highestRound = lastRound?.n ?? 0
  const outs = new Set(files.laneNames.filter(name => name.endsWith('.out')).map(name => name.slice(0, -'.out'.length)))
  const lanes = plan.kind === 'ok' ? plan.value.lanes.map((lane, n) => ({ ...lane, n, hasOut: outs.has(String(n)) })) : []
  const runState = state.kind === 'ok' ? state.value : null
  const entryOf = (n: number) => runState?.lanes[String(n)]
  const labels = plan.kind === 'ok' ? plan.value.msps.map(msp => msp.label) : []
  const msps: MspRow[] = labels.map((label, i) => {
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
    return {
      label,
      branch: tree?.branch ?? `mitosis/${label}`,
      shipBranch: msp?.ship?.branch ?? null,
      status: state.kind === 'bad' ? 'unknown' : known.status,
      lanesDone: own.filter(lane => entryOf(lane.n) !== undefined).length,
      lanesTotal: own.length,
      tier: own[0]?.tier ?? '',
      round: known.round,
      pr: msp?.ship?.pullRequest ?? '',
      proof:
        msp?.gate === null || msp?.gate === undefined
          ? null
          : {
              isRedSeen: properties.some(property => property.outcome === 'pass'),
              isGreenSeen: properties.some(property => property.with_work === 0),
            },
    }
  })
  const building = state.kind === 'bad' ? [] : lanes.filter(lane => lane.hasOut && entryOf(lane.n) === undefined)
  const candidates = candidatesOf(files.ledger, location.slug)
  const order = (label: string) => {
    const at = labels.indexOf(label)
    return at === -1 ? labels.length : at
  }
  const rounds: RoundRow[] = files.rounds.flatMap(round =>
    Object.keys(round.verdicts)
      .sort((a, b) => order(a) - order(b) || a.localeCompare(b))
      .map(label => {
        const verdict = verdictOf(round, label)
        return {
          n: round.n,
          msp: label,
          candidates: candidates.get(`${round.n}/${label}`) ?? null,
          blockers: verdict.kind === 'ok' ? verdict.value.blockers : 0,
          advisories: verdict.kind === 'ok' ? verdict.value.advisories : 0,
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
    fileStage,
    highestRound,
    msps,
    rounds,
    buildingLanes: building.length,
    buildingTier: building[0]?.tier ?? '',
    oldestMtimeMs: fileTimes.length > 0 ? Math.min(...fileTimes) : null,
  }
}

function stageOf(files: FileFacts, signals: Signals, previous: RunView | null): Stage | 'unknown' {
  const call = signals.callStage
  const merged: Stage | 'unknown' =
    files.fileStage === 'unknown'
      ? call !== null && STAGES.indexOf(call) >= STAGES.indexOf('ship')
        ? call
        : 'unknown'
      : files.fileStage === null
        ? (call ?? 'unknown')
        : call === null
          ? files.fileStage
          : laterOf(files.fileStage, call)
  if (previous === null || !isSameRun(previous, files) || previous.stage === 'unknown' || merged === 'unknown') {
    return merged
  }
  const isBehind = STAGES.indexOf(previous.stage) > STAGES.indexOf(merged)
  const isNewRound = previous.stage === 'fix' && merged === 'review'
  return isBehind && !isNewRound ? previous.stage : merged
}

const earliest = (times: readonly (number | null)[]): number | null => {
  const known = times.filter((time): time is number => time !== null)
  return known.length > 0 ? Math.min(...known) : null
}

function withPull(msp: MspRow, signals: Signals): MspRow {
  if (msp.pr !== '') return msp.status === 'failed' ? msp : { ...msp, status: 'pr' }
  const pull = signals.pulls.find(one => one.head === msp.shipBranch || one.head === msp.branch)
  if (pull === undefined) return msp
  return { ...msp, pr: `#${pull.number}`, status: msp.status === 'failed' ? 'failed' : 'pr' }
}

type RunIdentity = { readonly slug: string; readonly home: string | null }

export const isSameRun = (one: RunIdentity, other: RunIdentity) => one.slug === other.slug && one.home === other.home

export const isRunStarted = (files: FileFacts | null, signals: Signals) =>
  signals.callStage !== null || (files?.home ?? null) !== null

export function buildView(files: FileFacts | null, signals: Signals, previous: RunView | null): RunView | null {
  if (files === null || !isRunStarted(files, signals)) return null
  if (signals.finishedRun != null && isSameRun(signals.finishedRun, files)) return null
  const stage = stageOf(files, signals, previous)
  return {
    slug: files.slug,
    repo: files.repo,
    home: files.home,
    stage,
    round: stage === 'review' || stage === 'fix' || stage === 'unknown' ? files.highestRound : 0,
    isFinished: signals.isCleanDone,
    lane: signals.lane,
    startedAt: earliest([files.oldestMtimeMs, signals.firstCallAt]),
    msps: files.msps.map(msp => withPull(msp, signals)),
    rounds: files.rounds,
    agents: signals.agents,
    buildingLanes: files.buildingLanes,
    buildingTier: files.buildingTier,
    costUsd: signals.costUsd,
    isPullRequestRunning: signals.isPullRequestRunning,
  }
}
