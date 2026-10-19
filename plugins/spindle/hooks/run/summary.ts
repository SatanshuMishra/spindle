import type { AgentRow, MspRow, RoundRow, RunView } from '../../types'

export const NO_RUN = 'No pipeline run in this session.'

const MODEL = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?!\d)/

export function modelName(model: string): string {
  const match = MODEL.exec(model)
  if (match === null) return model
  const [, family = '', major = '', minor] = match
  const name = family.charAt(0).toUpperCase() + family.slice(1)
  return minor === undefined ? `${name} ${major}` : `${name} ${major}.${minor}`
}

export function elapsed(startedAt: number | null, now: number): string {
  if (startedAt === null) return '?'
  const minutes = Math.max(0, Math.floor((now - startedAt) / 60_000))
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

const mspLine = (msp: MspRow) =>
  [
    `msp ${msp.label} ${msp.status} ${msp.lanesDone}/${msp.lanesTotal}`,
    `proof ${msp.proof?.isRedSeen ? 'red' : 'none'},${msp.proof?.isGreenSeen ? 'green' : 'none'}`,
    `branch ${msp.branch}`,
    `pr ${msp.pr === '' ? 'none' : msp.pr}`,
    `round ${msp.round}`,
  ].join(' ')

const roundLine = (round: RoundRow) =>
  `round ${round.n} ${round.msp} candidates ${round.candidates ?? '?'} blockers ${round.blockers} advisories ${round.advisories} outcome ${round.outcome}`

const agentLine = (agent: AgentRow) =>
  `agent ${agent.id} ${agent.role} ${agent.type} ${modelName(agent.model)} ${agent.isRunning ? 'running' : 'done'}`

export function summary(view: RunView | null, now: number): string {
  if (view === null) return NO_RUN
  return [
    `run ${view.slug} repo ${view.repo ?? '?'}`,
    `lane ${view.lane ?? 'unknown'}`,
    `stage ${view.stage} round ${view.round} finished ${view.isFinished ? 'yes' : 'no'}`,
    `elapsed ${elapsed(view.startedAt, now)}`,
    ...view.msps.map(mspLine),
    ...view.rounds.map(roundLine),
    ...view.agents.map(agentLine),
    `builders ${view.buildingLanes}`,
    `cost ${view.costUsd.toFixed(4)}`,
    `agents ${view.agents.filter(agent => agent.isRunning).length} live ${view.agents.length} total`,
  ].join('\n')
}
