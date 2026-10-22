import type { AgentRow, FileFacts, LaneFact, MspRow, RoundActivity, RoundFiles, RoundState, Signals, WorkerRow } from '../../types'
import { plural } from './summary'

const VERDICT_STATES: ReadonlySet<RoundState> = new Set(['green', 'loop', 'blocked', 'hard-failure', 'diagnosing'])
const ROUND_NAMED = /\bround[\s-]*(\d+)/i

export const isVerdictState = (state: RoundState | null) => state !== null && VERDICT_STATES.has(state)

type Worktree = FileFacts['worktrees'][number]

const NO_DETAIL = { round: null, model: null, startedAt: null, contextShare: null } as const

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const PATH_CHARS = 'A-Za-z0-9_.~/-'

const isNamed = (text: string, label: string) =>
  new RegExp(`(^|[^A-Za-z0-9_-])${escaped(label)}($|[^A-Za-z0-9_-])`).test(text)

const isPathNamed = (text: string, path: string) =>
  new RegExp(
    `(^|[^${PATH_CHARS}])${escaped(path.replace(/\/+$/, ''))}(?=$|/|\\.(?![A-Za-z0-9_-])|[^${PATH_CHARS}])`,
  ).test(text)

export function mspNamed(text: string, msps: readonly MspRow[], worktrees: readonly Worktree[]): MspRow | null {
  return (
    msps.find(
      msp => isNamed(text, msp.label) || worktrees.some(tree => tree.msp === msp.label && isPathNamed(text, tree.path)),
    ) ?? null
  )
}

const MSP_LINE = /^msp: (.+)$/

export function mspOfAgent(text: string, msps: readonly MspRow[], worktrees: readonly Worktree[]): MspRow | null {
  const lined = text
    .split('\n')
    .map(line => MSP_LINE.exec(line.trim())?.[1])
    .map(label => msps.find(msp => msp.label === label))
    .find((msp): msp is MspRow => msp !== undefined)
  return lined ?? mspNamed(text, msps, worktrees)
}

const latestRound = (msp: MspRow | null): number | null =>
  [...(msp?.activities ?? [])].reverse().find(activity => activity.kind === 'round')?.round ?? null

export function agentWords(agent: AgentRow, msp: MspRow | null): { words: string; round: number | null } {
  const named = ROUND_NAMED.exec(`${agent.prompt} ${agent.description}`)?.[1]
  const round = msp === null ? null : named !== undefined ? Number(named) : latestRound(msp)
  if (round !== null && agent.role === 'judge') return { words: `Round ${round} · validating`, round }
  if (round !== null && agent.role === 'detective') return { words: `Round ${round} · reviewing`, round }
  return { words: agent.description === '' ? agent.type : agent.description, round }
}

function finishedWords(agent: AgentRow): string {
  if (agent.round !== null && agent.role === 'detective') return `Round ${agent.round} · reviewed`
  if (agent.round !== null && agent.role === 'judge') return `Round ${agent.round} · validated`
  return agent.description === '' ? agent.type : agent.description
}

function agentRow(agent: AgentRow, msps: readonly MspRow[], worktrees: readonly Worktree[]): WorkerRow {
  if (!agent.isRunning) {
    return {
      msp: agent.msp,
      role: agent.role,
      words: finishedWords(agent),
      isLive: false,
      round: agent.round,
      model: agent.model,
      startedAt: agent.startedAt,
      contextShare: null,
    }
  }
  const msp = mspOfAgent(`${agent.prompt}\n${agent.description}`, msps, worktrees)
  const { words, round } = agentWords(agent, msp)
  return {
    msp: msp?.label ?? null,
    role: agent.role,
    words,
    isLive: true,
    round,
    model: agent.model,
    startedAt: agent.startedAt,
    contextShare: agent.contextMax > 0 ? agent.contextTokens / agent.contextMax : null,
  }
}

const laneRow = (lane: LaneFact): WorkerRow => ({
  ...NO_DETAIL,
  msp: lane.msp,
  role: 'builder',
  words: `Lane ${lane.n} · ${lane.state}`,
  isLive: lane.state === 'building',
})

const roundRow = (files: RoundFiles, role: WorkerRow['role'], words: string): WorkerRow => ({
  ...NO_DETAIL,
  msp: files.msp,
  role,
  words: `Round ${files.n} · ${words}`,
  isLive: false,
  round: files.n,
})

function judgeWords(activity: RoundActivity): string {
  const outcome = activity.state === 'diagnosing' ? 'diagnose' : (activity.state ?? '')
  return [outcome, activity.counts, activity.kinds[0]].filter((part): part is string => part !== undefined && part !== '').join(' · ')
}

const isJudged = (state: RoundState | null) => isVerdictState(state) || state === 'status unknown'

function roundRows(files: RoundFiles, msps: readonly MspRow[]): WorkerRow[] {
  const verdict = msps
    .find(msp => msp.label === files.msp)
    ?.activities.find((activity): activity is RoundActivity => activity.kind === 'round' && activity.round === files.n && isJudged(activity.state))
  const detectives =
    files.findingSources === null
      ? [roundRow(files, 'detective', 'findings status unknown')]
      : files.findingSources.map(({ source, count }) => roundRow(files, 'detective', `${source} · ${plural(count, 'finding')}`))
  return [
    ...detectives,
    ...(verdict === undefined ? [] : [roundRow(files, 'judge', judgeWords(verdict))]),
    ...files.diagnoses.map(kind => roundRow(files, 'diagnosis', `diagnosed · ${kind}`)),
    ...files.smokes.map(platform => roundRow(files, 'smoke', `smoke · ${platform}`)),
  ]
}

const COURIER: WorkerRow = { ...NO_DETAIL, msp: null, role: 'courier', words: 'Ship · opening pull request', isLive: true }
const CAPTAIN: WorkerRow = { ...NO_DETAIL, msp: null, role: 'captain', words: 'main thread', isLive: true }

const isShownByRoundFiles = (agent: AgentRow, files: FileFacts) =>
  (agent.role === 'detective' || agent.role === 'judge') &&
  files.roundFiles.some(round => round.msp === agent.msp && round.n === agent.round)

const isMainThreadLive = (files: FileFacts, signals: Signals) =>
  !signals.isCleanDone && files.source === 'home' && files.events.end === null

export function workersOf(files: FileFacts, msps: readonly MspRow[], signals: Signals): WorkerRow[] {
  const live = [
    ...signals.agents.filter(agent => agent.isRunning).map(agent => agentRow(agent, msps, files.worktrees)),
    ...files.lanes.filter(lane => lane.state === 'building').map(laneRow),
    ...(signals.isPullRequestRunning ? [COURIER] : []),
  ]
  const done = [
    ...signals.agents
      .filter(agent => !agent.isRunning && agent.msp !== null && !isShownByRoundFiles(agent, files))
      .map(agent => agentRow(agent, msps, files.worktrees)),
    ...files.lanes.filter(lane => lane.state !== 'building').map(laneRow),
    ...files.roundFiles.flatMap(round => roundRows(round, msps)),
  ]
  const captain = live.length === 0 && isMainThreadLive(files, signals) ? [CAPTAIN] : []
  return [...live, ...captain, ...done]
}
