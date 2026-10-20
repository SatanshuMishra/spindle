import type { Activity, MspRow, RunView } from '../../types'
import { isSameRun } from './infer'
import { isVerdictState } from './workers'

type Judged = { msp: string; activity: Activity }

const judgedRounds = (view: RunView): Judged[] =>
  view.msps.flatMap(msp =>
    msp.activities
      .filter(activity => activity.kind === 'round' && isVerdictState(activity.state))
      .map(activity => ({ msp: msp.label, activity })),
  )

const isSameRound = (one: Judged, other: Judged) => one.msp === other.msp && one.activity.round === other.activity.round

const verdictToast = ({ msp, activity }: Judged) => {
  const kind = activity.kinds[0]
  return `${msp} round ${activity.round}: ${activity.summary[0] ?? ''}${kind === undefined ? '' : ` · ${kind}`}`
}

const pullToast = (msp: MspRow) => `${msp.label}: pull request ${msp.pr} opened`

function verdictToasts(before: RunView, after: RunView): string[] {
  const known = judgedRounds(before)
  return judgedRounds(after)
    .filter(judged => !known.some(old => isSameRound(old, judged)))
    .map(verdictToast)
}

const pullToasts = (before: RunView, after: RunView): string[] =>
  after.msps
    .filter(msp => msp.pr !== '' && (before.msps.find(old => old.label === msp.label)?.pr ?? '') === '')
    .map(pullToast)

export function changes(before: RunView | null, after: RunView): string[] {
  if (before === null || !isSameRun(before, after)) return []
  return [...verdictToasts(before, after), ...pullToasts(before, after)]
}
