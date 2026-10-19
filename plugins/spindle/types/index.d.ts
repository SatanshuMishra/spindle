export type Stage = 'spec' | 'build' | 'review' | 'fix' | 'ship' | 'integrate' | 'clean'

export type MspStatus = 'planned' | 'building' | 'built' | 'review' | 'fixing' | 'green' | 'blocked' | 'pr' | 'failed' | 'unknown'

export type Outcome = 'green' | 'loop' | 'diagnose' | 'blocked' | 'hard-failure' | 'unknown'

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
}

export type RoundRow = {
  n: number
  msp: string
  candidates: number | null
  blockers: number
  advisories: number
  outcome: Outcome
}

export type FileFacts = {
  slug: string
  repo: string | null
  home: string | null
  runDir: string | null
  fileStage: Stage | 'unknown' | null
  highestRound: number
  msps: MspRow[]
  rounds: RoundRow[]
  buildingLanes: number
  buildingTier: string
  oldestMtimeMs: number | null
}

export type Lane = 'full' | 'standard'

export type Role = 'captain' | 'scribe' | 'builder' | 'detective' | 'judge' | 'courier' | 'plain'

export type AgentRow = {
  id: string
  role: Role
  type: string
  description: string
  model: string
  startedAt: number
  contextTokens: number
  contextMax: number
  isRunning: boolean
}

export type PullRow = { head: string; number: string }

export type RunIdentity = { readonly slug: string; readonly home: string | null }

export type Signals = {
  lane: Lane | null
  callStage: Stage | null
  isCleanDone: boolean
  firstCallAt: number | null
  agents: AgentRow[]
  isPullRequestRunning: boolean
  pulls: PullRow[]
  costUsd: number
  finishedRun?: RunIdentity | null
}

export type RunView = {
  slug: string
  repo: string | null
  home: string | null
  stage: Stage | 'unknown'
  round: number
  isFinished: boolean
  lane: Lane | null
  startedAt: number | null
  msps: MspRow[]
  rounds: RoundRow[]
  agents: AgentRow[]
  buildingLanes: number
  buildingTier: string
  costUsd: number
  isPullRequestRunning: boolean
}

declare module 'claude-code' {
  interface PluginState {
    spindle: {
      files: FileFacts | null
      signals: Signals
      view: RunView | null
      dismissedAt: Stage | 'unknown' | null
    }
  }
}
