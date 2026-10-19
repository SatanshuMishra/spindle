import type { Elements, RenderElement } from 'claude-code'

export type HintElements = Pick<Elements['terminal'], 'Box' | 'Text'>

export function hint(
  ui: HintElements,
  key: string,
  visible: RenderElement | readonly RenderElement[],
  lines: readonly string[],
): RenderElement {
  const { Box, Text } = ui
  if (lines.length === 0) {
    return (
      <Box key={key} flexDirection="row" alignItems="center" gap={1}>
        {visible}
      </Box>
    )
  }
  return (
    <Box key={key} flexDirection="row" alignItems="center" gap={1}>
      {visible}
      <Box
        position="absolute"
        top={-(lines.length + 2)}
        left={0}
        display="none"
        hover={{ display: 'flex' }}
        flexDirection="column"
        borderStyle="round"
        paddingX={1}
      >
        {lines.map(line => (
          <Text>{line}</Text>
        ))}
      </Box>
    </Box>
  )
}
