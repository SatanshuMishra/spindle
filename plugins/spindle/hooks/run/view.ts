import { atom, read, update } from 'claude-code'
import type { StateDollar } from 'claude-code'

import type { Signals } from '../../types'
import { buildView } from './infer'

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

export async function refresh($: StateDollar): Promise<void> {
  const [files, signals, previous] = await Promise.all([read($, filesState), read($, signalsState), read($, viewState)])
  const next = buildView(files, signals, previous)
  if (JSON.stringify(next) === JSON.stringify(previous)) return
  await update($, viewState, current => buildView(files, signals, current))
}
