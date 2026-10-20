import type { Elements, RenderElement } from 'claude-code'

import { columnsOf } from './text'

export type HintElements = Pick<Elements['terminal'], 'Box' | 'Text'>

export type HintPlace = {
  side?: 'above' | 'below'
  edge?: 'start' | 'end'
  size?: 'fixed' | 'shrink' | 'grow'
}

export const CARD_BACKGROUND = '#2a2a29'
export const CARD_TEXT = '#ffffff'
const CARD_PAD = 1
const CARD_SPARE = 2

const cardColumns = (lines: readonly string[]) => Math.max(0, ...lines.map(columnsOf)) + 2 * CARD_PAD + CARD_SPARE

export function hint(
  ui: HintElements,
  key: string,
  visible: RenderElement | readonly RenderElement[],
  lines: readonly string[],
  { side = 'above', edge = 'start', size = 'fixed' }: HintPlace = {},
): RenderElement {
  const { Box, Text } = ui
  const vertical = side === 'above' ? { top: -lines.length } : { bottom: -lines.length }
  const horizontal = edge === 'start' ? { left: 0 } : { right: 0 }
  const sizing =
    size === 'grow' ? { flexGrow: 1, flexShrink: 1, minWidth: 0 } : size === 'shrink' ? { flexShrink: 1, minWidth: 0 } : { flexShrink: 0 }
  return (
    <Box key={key} flexDirection="row" alignItems="center" gap="xs" {...sizing}>
      {visible}
      {lines.length === 0 ? null : (
        <Box
          position="absolute"
          {...vertical}
          {...horizontal}
          width={cardColumns(lines)}
          display="none"
          hover={{ display: 'flex' }}
          flexDirection="column"
          backgroundColor={CARD_BACKGROUND}
          paddingX={CARD_PAD}
        >
          {lines.map(line => (
            <Text color={CARD_TEXT}>{line}</Text>
          ))}
        </Box>
      )}
    </Box>
  )
}
