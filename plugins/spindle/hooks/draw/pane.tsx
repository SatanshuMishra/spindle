import type { EngineInterface, RenderInput } from 'claude-code'

import { NO_RUN } from '../run/summary'

export const PANE = 'spindle-run'
export const PANE_TITLE = 'Pipeline'

export async function togglePane($: EngineInterface): Promise<string> {
  const panes = await $.ui.panes()
  if (panes.some(pane => pane.id === PANE)) {
    await $.ui.close({ id: PANE })
    return 'Run pane closed.'
  }
  await $.ui.open({ id: PANE, title: PANE_TITLE })
  return 'Run pane opened.'
}

export function drawEmptyPane($: EngineInterface, e: RenderInput<'Pane'>) {
  const { Box, Text } = $.ui.resolve(e)

  return (
    <Box flexDirection="column">
      <Text dimColor>{NO_RUN}</Text>
    </Box>
  )
}
