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

export type CardSizing = 'fixed' | 'shrink' | 'grow'

export type Card = { scope: string; lines: readonly string[] }

export type SlotPlace = { top?: number; left?: number; right?: number; bottom?: number }

const sizingOf = (size: CardSizing) =>
  size === 'grow' ? { flexGrow: 1, flexShrink: 1, minWidth: 0 } : size === 'shrink' ? { flexShrink: 1, minWidth: 0 } : { flexShrink: 0 }

export function cardTrigger(
  ui: Pick<HintElements, 'Box'>,
  scope: string,
  visible: RenderElement | readonly RenderElement[],
  size: CardSizing = 'fixed',
): RenderElement {
  const { Box } = ui
  return (
    <Box key={scope} hover={{ scope }} flexDirection="row" alignItems="center" {...sizingOf(size)}>
      {visible}
    </Box>
  )
}

export const tallestCard = (cards: readonly Card[]) => Math.max(0, ...cards.map(card => card.lines.length))

export function cardSlot(ui: HintElements, key: string, cards: readonly Card[], place: SlotPlace): RenderElement {
  const { Box, Text } = ui
  return (
    <Box key={key} position="absolute" {...place} flexDirection="column">
      {cards
        .filter(card => card.lines.length > 0)
        .map(card => (
          <Box
            key={`${card.scope}-card`}
            display="none"
            hover={{ scope: card.scope, display: 'flex' }}
            flexDirection="column"
            backgroundColor={CARD_BACKGROUND}
            paddingX={CARD_PAD}
          >
            {card.lines.map(line => (
              <Text color={CARD_TEXT}>{line}</Text>
            ))}
          </Box>
        ))}
    </Box>
  )
}
