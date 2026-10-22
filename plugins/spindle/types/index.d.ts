export type Stage = 'spec' | 'build' | 'review' | 'fix' | 'ship' | 'integrate' | 'clean'

export type MspStatus = 'planned' | 'building' | 'built' | 'review' | 'fixing' | 'green' | 'blocked' | 'pr' | 'failed' | 'unknown'

export type Outcome = 'green' | 'loop' | 'diagnose' | 'blocked' | 'hard-failure' | 'unknown'

export type ActivityKind = 'build' | 'round' | 'fix' | 'ship'

export type RoundState = 'suite running' | 'reviewing' | 'validating' | 'diagnosing' | 'status unknown' | Exclude<Outcome, 'diagnose' | 'unknown'>

export type ActivityFacts = {
  round: number | null
  name: string
  words: string
  state: RoundState | null
  isRunning: boolean
  startedAt: number | null
  summary: readonly string[]
  kinds: readonly string[]
}

export type RoundActivity = ActivityFacts & { kind: 'round'; counts: string }

export type Activity = RoundActivity | (ActivityFacts & { kind: Exclude<ActivityKind, 'round'> })

export type MspRow = {
  label: string
  branch: string
  shipBranch: string | null
  status: MspStatus
  lanesDone: number
  lanesTotal: number
  tier: string
  round: number
  pr: string
  proof: { isRedSeen: boolean; isGreenSeen: boolean } | null
  activities: readonly Activity[]
  current: number | null
  stage: Stage | 'unknown'
}

export type RoundRow = {
  n: number
  msp: string
  candidates: number | null
  blockers: number
  advisories: number
  outcome: Outcome
}

export type RoundFiles = {
  n: number
  msp: string
  findingSources: readonly { source: string; count: number }[] | null
  candidates: number | null
  diagnoses: readonly string[]
  smokes: readonly string[]
}

export type LaneFact = {
  n: number
  msp: string
  tier: string
  state: 'building' | 'done' | 'failed'
}

export type FollowsLink = { parent: string; lane: Lane | null }

export type HomeFacts = {
  slug: string
  repo: string | null
  home: string | null
  runDir: string | null
  hasPlan: 'absent' | 'bad' | 'ok'
  isStateBad: boolean
  hasLighthouse: boolean
  highestRound: number
  msps: MspRow[]
  rounds: RoundRow[]
  roundFiles: RoundFiles[]
  lanes: LaneFact[]
  worktrees: readonly { msp: string; path: string }[]
  buildingLanes: number
  buildingTier: string
  oldestMtimeMs: number | null
  follows: FollowsLink | null
  lighthouseVerdict: string | null
}

export type VerdictEvent = { msp: string; round: number; outcome: Outcome; blockers: number; advisories: number }

export type RunEnd = { status: string | null; isDraft: boolean }

export type EventLog = 'absent' | 'unreadable' | 'read'

export type EventFacts = {
  log: EventLog
  lane: Lane | null
  follows: string | null
  startedAt: number | null
  stages: readonly Stage[]
  verdicts: readonly VerdictEvent[]
  isWorkAfterShip: boolean
  isCleanDone: boolean
  end: RunEnd | null
}

export type FactSource = 'home' | 'record' | 'events'

export type FileFacts = HomeFacts & { source: FactSource; events: EventFacts }

export type Lane = 'full' | 'standard' | 'direct'

export type Lifecycle =
  | 'unknown'
  | 'running'
  | 'shipped'
  | 'reopened'
  | 'cleaned'
  | 'closed-done'
  | 'closed-draft'
  | 'stopped-critical'
  | 'superseded'

export type FinalState = 'closed-done' | 'closed-draft' | 'stopped-critical' | 'superseded' | 'cleaned' | 'abandoned' | 'unknown'

export type Finish = {
  state: FinalState
  word: string
  isCelebrated: boolean
  headline: string
  details: readonly string[]
}

export type FinishSeen = {
  slug: string
  home: string | null
  at: number
  isLive: boolean
  isSettled: boolean
}

export type Role = 'captain' | 'scribe' | 'builder' | 'detective' | 'judge' | 'courier' | 'plain'

export type AgentRow = {
  id: string
  role: Role
  type: string
  description: string
  prompt: string
  model: string
  startedAt: number
  contextTokens: number
  contextMax: number
  isRunning: boolean
  msp: string | null
  round: number | null
}

export type WorkerRole = Role | 'diagnosis' | 'smoke'

export type WorkerRow = {
  msp: string | null
  role: WorkerRole
  words: string
  isLive: boolean
  round: number | null
  model: string | null
  startedAt: number | null
  contextShare: number | null
}

export type PullRow = { head: string; number: string }

export type RunIdentity = { readonly slug: string; readonly home: string | null }

export type FinishedRun = RunIdentity & { readonly signals: Signals }

export type Signals = {
  lane: Lane | null
  callStage: Stage | null
  isCleanDone: boolean
  firstCallAt: number | null
  agents: AgentRow[]
  isPullRequestRunning: boolean
  pulls: PullRow[]
  costUsd: number
  finishedRun?: FinishedRun | null
}

export type RunView = {
  slug: string
  repo: string | null
  home: string | null
  follows: string | null
  stage: Stage | 'unknown'
  round: number
  isFinished: boolean
  lifecycle: Lifecycle
  finish: Finish | null
  lane: Lane | null
  startedAt: number | null
  msps: MspRow[]
  rounds: RoundRow[]
  agents: AgentRow[]
  workers: WorkerRow[]
  buildingLanes: number
  buildingTier: string
  costUsd: number
  isPullRequestRunning: boolean
  pulls: PullRow[]
}

declare module 'claude-code' {
  interface PluginState {
    spindle: {
      files: FileFacts | null
      signals: Signals
      view: RunView | null
      dismissedAt: string | null
      selectedMsp: string | null
      finishSeen: FinishSeen | null
    }
  }
}
