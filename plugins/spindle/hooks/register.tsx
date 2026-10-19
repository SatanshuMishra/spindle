import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { drawBand } from './draw/band'
import { PANE, drawPane, togglePane } from './draw/pane'
import { startPolling } from './run/poll'
import { agentSpawnSignals, toolCallSignals, turnCompleteSignals, turnStepSignals } from './run/signals'
import { summary } from './run/summary'

const viewState = atom({ plugin: 'spindle', key: 'view' } as const, null)
const dismissedState = atom({ plugin: 'spindle', key: 'dismissedAt' } as const, null)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({
      name: 'spindle',
      description: 'Show or hide the pipeline run pane; /spindle status prints the run as text',
    })
    await startPolling($)
    return started
  })

  on('tool.call', toolCallSignals).catch(($, e, next) => next(e))
  on('agent.spawn', agentSpawnSignals).catch(($, e, next) => next(e))
  on('turn.step', turnStepSignals)
  on('turn.complete', turnCompleteSignals)

  on('command.run', { command: 'spindle' }, async ($, e) => {
    if (e.args.trim() === 'status') {
      return { text: summary(await read($, viewState), await $.clock.now()) }
    }
    await update($, dismissedState, () => null)
    return { text: await togglePane($) }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => drawPane($, e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => drawBand($, e, () => next(e)))
}
