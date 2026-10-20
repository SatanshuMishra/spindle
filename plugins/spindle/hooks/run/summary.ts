import type { Activity, AgentRow, MspRow, RoundRow, RunView, WorkerRow } from '../../types'

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

export const plural = (count: number, word: string) =>
  `${count} ${count === 1 ? word : word.endsWith('y') ? `${word.slice(0, -1)}ies` : `${word}s`}`

export const currentActivity = (msp: MspRow): Activity | undefined => (msp.current === null ? undefined : msp.activities[msp.current])

export const activityNow = (activity: Activity, now: number): string =>
  activity.isRunning ? `${activity.words} · ${elapsed(activity.startedAt, now)}` : activity.words

export const summaryNow = (activity: Activity, now: number): readonly string[] =>
  activity.kind === 'round' && activity.isRunning && activity.state !== 'diagnosing'
    ? activity.summary.map((line, i) => (i === 0 ? `${line} · ${elapsed(activity.startedAt, now)}` : line))
    : activity.summary

const mspLine = (msp: MspRow) =>
  [
    `msp ${msp.label} ${msp.status} ${msp.lanesDone}/${msp.lanesTotal}`,
    `proof ${msp.proof?.isRedSeen ? 'red' : 'none'},${msp.proof?.isGreenSeen ? 'green' : 'none'}`,
    `branch ${msp.branch}`,
    `pr ${msp.pr === '' ? 'none' : msp.pr}`,
    `round ${msp.round}`,
  ].join(' ')

const nowLine = (msp: MspRow, now: number) => {
  const activity = currentActivity(msp)
  return `msp ${msp.label} now ${activity === undefined ? 'status unknown' : activityNow(activity, now)}`
}

const activityLines = (msp: MspRow, now: number) =>
  msp.activities.map(
    activity =>
      `activity ${msp.label} ${activity.name}${activity.kind === 'round' ? `: ${summaryNow(activity, now).join(' / ')}` : ''}`,
  )

const workerLine = (worker: WorkerRow) =>
  `worker ${worker.msp ?? '-'} ${worker.role} ${worker.words} · ${worker.isLive ? 'live' : 'done'}`

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
    ...view.msps.map(msp => nowLine(msp, now)),
    ...view.msps.flatMap(msp => activityLines(msp, now)),
    ...view.workers.map(workerLine),
    ...view.rounds.map(roundLine),
    ...view.agents.map(agentLine),
    `builders ${view.buildingLanes}`,
    `cost ${view.costUsd.toFixed(4)}`,
    `agents ${view.agents.filter(agent => agent.isRunning).length} live ${view.agents.length} total`,
  ].join('\n')
}
