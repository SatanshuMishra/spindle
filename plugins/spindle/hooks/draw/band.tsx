import { atom, read, update } from 'claude-code'
import type { EngineInterface, RenderElement, RenderInput } from 'claude-code'

import type { Lane, Role, RunView } from '../../types'
import { elapsed } from '../run/summary'
import { CRAB_BOX, CRAB_CSS, colorOf, costumeOf, crab } from './crew'
import { togglePane } from './pane'
import { ACCENT, DONE, FONT, STAGE_TABLE, THEME_CSS, fitText, noise, stageIndex, stageInfo, textWidth, xml } from './text'

const viewState = atom({ plugin: 'spindle', key: 'view' } as const, null)
const dismissedState = atom({ plugin: 'spindle', key: 'dismissedAt' } as const, null)

const BAND_H = 22
const BAR_H = 16
const CELL = 3
const TERMINAL_BAR = 18

const LANE_NAME: Readonly<Record<Lane, string>> = { full: 'Full', standard: 'Standard' }

type Worker = { role: Role; startedAt: number }

export function workingOf(view: RunView): readonly Worker[] {
  return [
    ...view.agents.filter(agent => agent.isRunning).map(agent => ({ role: agent.role, startedAt: agent.startedAt })),
    ...(view.buildingLanes > 0 ? [{ role: 'builder' as const, startedAt: Number.NEGATIVE_INFINITY }] : []),
    ...(view.isPullRequestRunning ? [{ role: 'courier' as const, startedAt: Number.POSITIVE_INFINITY }] : []),
  ]
}

export function leadOf(view: RunView): Role {
  const working = workingOf(view)
  const lead = working.reduce<Worker | null>((best, one) => (best === null || one.startedAt >= best.startedAt ? one : best), null)
  return lead?.role ?? 'captain'
}

const roundPart = (view: RunView) =>
  view.stage === 'review' || view.stage === 'fix' ? Math.min(0.9, view.round * 0.25) : 0

const progressOf = (view: RunView) =>
  view.isFinished ? 1 : (Math.max(0, stageIndex(view.stage)) + roundPart(view)) / STAGE_TABLE.length

function pillOf(view: RunView, separator: string): string {
  if (view.isFinished) return 'Done'
  const stage = stageInfo(view.stage)
  if (stage === null) return 'stage ?'
  return view.round > 0 ? `${stage.name}${separator}R${view.round}` : stage.name
}

export const pillText = (view: RunView) => pillOf(view, ' · ')

function bandSvg(view: RunView, W: number, time: string): string {
  const title = fitText(view.slug, 13, Math.max(60, W * 0.32))
  const lane = view.lane === null ? null : LANE_NAME[view.lane]
  const laneW = lane === null ? 0 : textWidth(lane, 10.5) + 14
  const LANE_X = Math.round(16 + textWidth(title, 13) + 8)
  const BAR_X = Math.round(LANE_X + (lane === null ? 0 : laneW + 10))
  const TAIL = 74
  const BAR_W = Math.max(60, W - BAR_X - TAIL)
  const stage = stageInfo(view.stage)
  const color = view.isFinished ? DONE : ACCENT
  const fillW = Math.round(BAR_W * progressOf(view))
  const y0 = (BAND_H - BAR_H) / 2
  const cols = Math.floor(fillW / CELL)
  const rows = Math.floor(BAR_H / CELL)
  const dots = Array.from({ length: cols }, (_, c) => {
    const density = 0.35 + 0.6 * Math.pow(c / Math.max(1, cols), 1.2)
    return Array.from({ length: rows }, (_, r) =>
      noise(c, r) < density
        ? `<rect class="t${Math.floor(noise(r, c) * 4)}" x="${c * CELL + 1}" y="${r * CELL + 1}" width="2" height="2"/>`
        : '',
    ).join('')
  }).join('')
  const ticks = Array.from({ length: STAGE_TABLE.length - 1 }, (_, i) => Math.round((BAR_W * (i + 1)) / STAGE_TABLE.length))
    .filter(x => x > fillW + 4)
    .map(x => `<rect x="${x}" y="${BAR_H / 2 - 4}" width="1.5" height="8" rx=".75"/>`)
    .join('')
  const label = pillText(view)
  const pillW = Math.round(18 + label.length * 6.4)
  const pillX = Math.max(0, Math.min(BAR_W - pillW, fillW - pillW))
  const lead = leadOf(view)
  const chip =
    lane === null
      ? ''
      : `<rect class="sv-k" x="${LANE_X}" y="${(BAND_H - 16) / 2}" width="${laneW}" height="16" rx="4"/>
<text class="sv-s" x="${LANE_X + laneW / 2}" y="${BAND_H / 2 + 3.8}" text-anchor="middle" font-family="${FONT}" font-size="10.5" font-weight="600">${xml(lane)}</text>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${BAND_H}" viewBox="0 0 ${W} ${BAND_H}" role="img" aria-label="${xml(view.slug)}: ${xml(label)}">
${THEME_CSS}<style>
.t0,.t1,.t2,.t3{animation:tw ${view.isFinished ? 3.2 : 2.2}s ease-in-out infinite}
.t1{animation-duration:2.8s;animation-delay:-.7s}.t2{animation-duration:1.9s;animation-delay:-1.3s}.t3{animation-duration:3.3s;animation-delay:-.4s}
@keyframes tw{0%,100%{opacity:1}50%{opacity:${view.isFinished ? 0.8 : 0.3}}}
@media (prefers-reduced-motion: reduce){.t0,.t1,.t2,.t3{animation:none}}
</style>
<defs><clipPath id="bc-${W}"><rect width="${BAR_W}" height="${BAR_H}" rx="${BAR_H / 2}"/></clipPath></defs>
<circle cx="5" cy="${BAND_H / 2}" r="4" fill="${view.isFinished ? DONE : (stage?.color ?? ACCENT)}"/>
<text class="sv-t" x="16" y="${BAND_H / 2 + 4.5}" font-family="${FONT}" font-size="13" font-weight="500">${xml(title)}</text>
${chip}
<g transform="translate(${BAR_X},${y0})">
<rect class="sv-k" width="${BAR_W}" height="${BAR_H}" rx="${BAR_H / 2}"/>
<g clip-path="url(#bc-${W})"><g fill="${color}">${dots}</g><g class="sv-tk">${ticks}</g></g>
<rect x="${pillX}" width="${pillW}" height="${BAR_H}" rx="${BAR_H / 2}" fill="${color}"/>
<text x="${pillX + pillW / 2}" y="${BAR_H / 2 + 4}" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="600" fill="#ffffff">${xml(label)}</text>
</g>
<text class="sv-m" x="${W - 34}" y="${BAND_H / 2 + 4.5}" text-anchor="end" font-family="${FONT}" font-size="12.5" style="font-variant-numeric:tabular-nums">${xml(time)}</text>
${CRAB_CSS}${crab(W - CRAB_BOX * 0.9, -1, costumeOf(lead), colorOf(lead), false, !view.isFinished, 0.8)}
</svg>`
}

export function terminalBand(view: RunView, time: string): string {
  const filled = Math.round(TERMINAL_BAR * progressOf(view))
  const lane = view.lane === null ? '' : `  [${LANE_NAME[view.lane]}]`
  const bar = `${'█'.repeat(filled)}${'░'.repeat(TERMINAL_BAR - filled)}`
  const working = workingOf(view).length
  return `● ${view.slug}${lane}  ${bar}  ${pillOf(view, ' ')} · ${view.msps.length} MSPs · ${working} agents  ${time}`
}

const isEnginePlaceholder = (drawn: unknown) =>
  typeof drawn !== 'object' || drawn === null || (drawn as { type?: unknown }).type === 'engine'

export async function drawBand(
  $: EngineInterface,
  e: RenderInput<'AbovePrompt'>,
  beneath: () => Promise<RenderElement> | RenderElement,
): Promise<RenderElement> {
  const view = await read($, viewState)
  const dismissedAt = await read($, dismissedState)
  if (view === null || e.props.hasSurvey || (dismissedAt !== null && dismissedAt === view.stage)) return beneath()
  const drawn = await Promise.resolve(beneath()).catch(() => null)
  const below = isEnginePlaceholder(drawn) ? null : drawn
  const time = elapsed(view.startedAt, await $.clock.now())
  const ui = $.ui.resolve(e)
  const { Box, Text, Button } = ui
  const crew = (
    <Button key="spindle-crew" label={`×${workingOf(view).length}`} plain onPress={() => void togglePane($)} />
  )
  const dismiss = (
    <Button
      key="spindle-dismiss"
      label={e.surface === 'desktop' ? 'Dismiss' : '✕'}
      plain
      role="dismiss"
      onPress={async () => {
        const current = await read($, viewState)
        await update($, dismissedState, () => current?.stage ?? null)
      }}
    />
  )
  if (e.surface === 'desktop' && 'Svg' in ui) {
    const { Svg } = ui
    const width = Math.max(180, Math.min(1600, (e.props.bodyColumns || 100) * 8 - 96))
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Svg source={bandSvg(view, width, time)} alt={`${view.slug}: ${pillText(view)}`} width={width} height={BAND_H} />
          {crew}
          {dismiss}
        </Box>
        {below}
      </Box>
    )
  }
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" gap={2}>
        <Text>{terminalBand(view, time)}</Text>
        {crew}
        {dismiss}
      </Box>
      {below}
    </Box>
  )
}
