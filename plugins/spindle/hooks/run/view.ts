import { atom, read, update } from 'claude-code'
import type { CoreEngineInterface } from 'claude-code'

import type { RunView, Signals } from '../../types'
import { buildView } from './infer'
import { changes } from './toasts'

export type ViewDollar = Pick<CoreEngineInterface, 'state' | 'ui'>

export const NO_SIGNALS: Signals = {
  lane: null,
  callStage: null,
  isCleanDone: false,
  firstCallAt: null,
  agents: [],
  isPullRequestRunning: false,
  pulls: [],
  costUsd: 0,
}

const filesState = atom({ plugin: 'spindle', key: 'files' } as const, null)
const signalsState = atom({ plugin: 'spindle', key: 'signals' } as const, NO_SIGNALS)
const viewState = atom({ plugin: 'spindle', key: 'view' } as const, null)

export async function refresh($: ViewDollar): Promise<void> {
  const [files, signals, previous] = await Promise.all([read($, filesState), read($, signalsState), read($, viewState)])
  const next = buildView(files, signals, previous)
  if (JSON.stringify(next) === JSON.stringify(previous)) return
  let before: RunView | null = previous
  const after = await update($, viewState, current => {
    before = current
    return buildView(files, signals, current)
  })
  if (after === null) return
  changes(before, after).forEach(text => $.ui.toast(text))
}
