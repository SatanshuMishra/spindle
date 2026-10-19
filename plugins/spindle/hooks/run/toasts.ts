import type { MspRow, RoundRow, RunView } from '../../types'
import { stageInfo } from '../draw/text'

const stageWord = (view: RunView) => (view.isFinished ? 'Done' : (stageInfo(view.stage)?.name ?? null))

const sameRound = (one: RoundRow, other: RoundRow) => one.n === other.n && one.msp === other.msp

const roundToast = (round: RoundRow) =>
  `R${round.n} ${round.msp}: ${round.outcome} · ${round.blockers} blockers, ${round.advisories} advisories`

const pullToast = (msp: MspRow) => `${msp.label}: pull request ${msp.pr} opened`

function stageToasts(before: RunView, after: RunView): string[] {
  const word = stageWord(after)
  if (word === null || word === stageWord(before)) return []
  return [`${after.slug}: ${word}`]
}

const roundToasts = (before: RunView, after: RunView): string[] =>
  after.rounds.filter(round => !before.rounds.some(old => sameRound(old, round))).map(roundToast)

const pullToasts = (before: RunView, after: RunView): string[] =>
  after.msps
    .filter(msp => msp.pr !== '' && (before.msps.find(old => old.label === msp.label)?.pr ?? '') === '')
    .map(pullToast)

export function changes(before: RunView | null, after: RunView): string[] {
  if (before === null || before.slug !== after.slug) return []
  return [...stageToasts(before, after), ...roundToasts(before, after), ...pullToasts(before, after)]
}
