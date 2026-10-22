import { atom, read, update } from 'claude-code'
import type { CoreEngineInterface } from 'claude-code'

import type { FinishSeen, RunView } from '../../types'
import { buildView, isSameRun } from './infer'
import { NO_SIGNALS } from './state'
import { currentActivity } from './summary'
import { changes } from './toasts'

export type ViewDollar = Pick<CoreEngineInterface, 'state' | 'ui' | 'clock'>

export const SETTLE_MS = 5000

const filesState = atom({ plugin: 'spindle', key: 'files' } as const, null)
const signalsState = atom({ plugin: 'spindle', key: 'signals' } as const, NO_SIGNALS)
const viewState = atom({ plugin: 'spindle', key: 'view' } as const, null)
const dismissedState = atom({ plugin: 'spindle', key: 'dismissedAt' } as const, null)
const selectedState = atom({ plugin: 'spindle', key: 'selectedMsp' } as const, null)
const finishSeenState = atom({ plugin: 'spindle', key: 'finishSeen' } as const, null)

const isSeenRun = (seen: FinishSeen | null, view: RunView): seen is FinishSeen => seen !== null && isSameRun(seen, view)

export const isFinishSettled = (seen: FinishSeen | null, view: RunView): boolean =>
  !(isSeenRun(seen, view) && seen.isLive && !seen.isSettled)

const isSettleDue = (seen: FinishSeen | null, now: number): seen is FinishSeen =>
  seen !== null && !seen.isSettled && now >= seen.at + SETTLE_MS

function seenAfter(seen: FinishSeen | null, before: RunView | null, after: RunView | null, now: number): FinishSeen | null {
  if (after === null || after.finish === null) return null
  if (isSeenRun(seen, after)) return seen
  const isLive = before !== null && isSameRun(before, after) && before.finish === null
  return { slug: after.slug, home: after.home, at: now, isLive, isSettled: !isLive }
}

export const activitySignature = (view: RunView): string =>
  JSON.stringify(
    view.msps.map(msp => {
      const activity = currentActivity(msp)
      return [msp.label, activity?.words ?? '', activity?.state ?? '']
    }),
  )

const isOtherActivity = (before: RunView | null, after: RunView | null) =>
  before === null || after === null
    ? before !== after
    : !isSameRun(before, after) || activitySignature(before) !== activitySignature(after)

const isSelectionGone = (selected: string, before: RunView | null, after: RunView | null) =>
  after === null || (before !== null && !isSameRun(before, after)) || !after.msps.some(msp => msp.label === selected)

export async function refresh($: ViewDollar): Promise<void> {
  const [files, signals, previous, seen, now] = await Promise.all([
    read($, filesState),
    read($, signalsState),
    read($, viewState),
    read($, finishSeenState),
    $.clock.now(),
  ])
  if (isSettleDue(seen, now)) await update($, finishSeenState, current => (current === null ? null : { ...current, isSettled: true }))
  const next = buildView(files, signals)
  if (JSON.stringify(next) === JSON.stringify(previous)) return
  let before: RunView | null = previous
  const after = await update($, viewState, current => {
    before = current
    return buildView(files, signals)
  })
  await update($, finishSeenState, current => seenAfter(current, before, after, now))
  if (isOtherActivity(before, after)) await update($, dismissedState, () => null)
  const selected = await read($, selectedState)
  if (selected !== null && isSelectionGone(selected, before, after)) await update($, selectedState, () => null)
  if (after === null) return
  changes(before, after).forEach(text => $.ui.toast(text))
}
