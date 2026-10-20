import { atom, read, update } from 'claude-code'
import type { CoreEngineInterface } from 'claude-code'

import type { RunView } from '../../types'
import { buildView, isSameRun } from './infer'
import { NO_SIGNALS } from './state'
import { currentActivity } from './summary'
import { changes } from './toasts'

export type ViewDollar = Pick<CoreEngineInterface, 'state' | 'ui'>

const filesState = atom({ plugin: 'spindle', key: 'files' } as const, null)
const signalsState = atom({ plugin: 'spindle', key: 'signals' } as const, NO_SIGNALS)
const viewState = atom({ plugin: 'spindle', key: 'view' } as const, null)
const dismissedState = atom({ plugin: 'spindle', key: 'dismissedAt' } as const, null)
const selectedState = atom({ plugin: 'spindle', key: 'selectedMsp' } as const, null)

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
  const [files, signals, previous] = await Promise.all([read($, filesState), read($, signalsState), read($, viewState)])
  const next = buildView(files, signals)
  if (JSON.stringify(next) === JSON.stringify(previous)) return
  let before: RunView | null = previous
  const after = await update($, viewState, current => {
    before = current
    return buildView(files, signals)
  })
  if (isOtherActivity(before, after)) await update($, dismissedState, () => null)
  const selected = await read($, selectedState)
  if (selected !== null && isSelectionGone(selected, before, after)) await update($, selectedState, () => null)
  if (after === null) return
  changes(before, after).forEach(text => $.ui.toast(text))
}
