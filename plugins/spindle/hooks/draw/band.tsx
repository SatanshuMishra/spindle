import { atom, read, update } from 'claude-code'
import type { Elements, EngineInterface, RenderElement, RenderInput, UiPressArgument } from 'claude-code'

import type { Lane, Role, RunView } from '../../types'
import { LANE_NAME } from '../run/state'
import { activityNow, currentActivity, elapsed } from '../run/summary'
import { activitySignature } from '../run/view'
import { CRAB_CSS, colorOf, costumeOf, crab } from './crew'
import { cardSlot, cardTrigger, hint, tallestCard } from './hint'
import type { Card } from './hint'
import { stageSummary, togglePane } from './pane'
import { ACCENT, CHIP_H, DONE, FONT, STAGE_TABLE, THEME_CSS, chipSvg, chipWidthOf, noise, stageIndex, stageInfo, svg, xml } from './text'

const viewState = atom({ plugin: 'spindle', key: 'view' } as const, null)
const dismissedState = atom({ plugin: 'spindle', key: 'dismissedAt' } as const, null)

const BAR_H = 16
const CELL = 3
const TEXTURE_W = 1600
const TEXTURE_DENSITY = 0.65
const TICK_W = 2
const TICK_H = 8
const CRAB_W = 24
const CRAB_H = 22
const BAR_SPARE_COLUMNS = 12
const BAR_COLUMNS = 60
const TRACK = 'rgba(128,128,120,.24)'
const DOT_PX = 10
const DOT = '●'
const ICON = '◉'
const DISMISS = '✕'
const DISMISS_HINT = 'Hide until an MSP moves to a new activity'
const COPY_HINT = 'Press to copy the name'
const COPY_FAILED = "Couldn't copy the name here"
const COUNT_HINT = 'Show the Pipeline pane'
const PROGRESS_SCOPE = 'spindle-band-progress'
const STAGE_SCOPE = 'spindle-band-stage'
const LANE_SCOPE = 'spindle-band-lane'
const LANE_MEANING: Readonly<Record<Lane, string>> = {
  full: 'Full lane: interview, spec, build, review until green',
  standard: 'Standard lane: brief, one build, one review round',
}

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

export function pillText(view: RunView): string {
  if (view.isFinished) return 'Done'
  const stage = stageInfo(view.stage)
  if (stage === null) return 'stage ?'
  return view.round > 0 ? `${stage.name} · R${view.round}` : stage.name
}

const pillWidthOf = (label: string) => Math.round(18 + label.length * 6.4)

const laneOf = (view: RunView) => (view.lane === null ? null : LANE_NAME[view.lane])

const nameHintOf = (view: RunView) => {
  const lane = laneOf(view)
  return lane === null ? view.slug : `${view.slug} · ${lane} lane`
}

const countHintOf = (working: number) => `${COUNT_HINT} · ${working} working now`

const mspLinesOf = (view: RunView, now: number): readonly string[] =>
  view.msps.map(msp => {
    const activity = currentActivity(msp)
    return `${msp.label}: ${activity === undefined ? 'status unknown' : activityNow(activity, now)}`
  })

const dotColorOf = (view: RunView) => (view.isFinished ? DONE : (stageInfo(view.stage)?.color ?? ACCENT))

const barColorOf = (view: RunView) => (view.isFinished ? DONE : ACCENT)

type BandRoom = {
  columns: number
  fixed: readonly number[]
  slug: number
  icon: number | null
  lane: number | null
  pill: number
  barMin: number
}

type BandPlan = { isSlugShown: boolean; isLaneShown: boolean; isBarShown: boolean; barColumns: number }

const present = (parts: readonly (number | null)[]): number[] => parts.filter((part): part is number => part !== null)

const rowColumns = (parts: readonly (number | null)[]) => {
  const drawn = present(parts)
  return drawn.reduce((sum, part) => sum + part, 0) + Math.max(0, drawn.length - 1)
}

function planBand(room: BandRoom): BandPlan {
  const fits = (parts: readonly (number | null)[]) => rowColumns(parts) <= room.columns
  const isBarShown = fits([...room.fixed, room.icon, room.barMin])
  const middle = isBarShown ? room.barMin : room.pill
  const isSlugShown = fits([...room.fixed, room.slug, middle])
  const name = isSlugShown ? room.slug : room.icon
  const isLaneShown = isSlugShown && isBarShown && room.lane !== null && fits([...room.fixed, name, room.lane, room.barMin])
  const others = [...room.fixed, name, isLaneShown ? room.lane : null]
  const barColumns = isBarShown ? room.columns - rowColumns(others) - 1 : 0
  return { isSlugShown, isLaneShown, isBarShown, barColumns }
}

function barSvg(view: RunView): string {
  const cols = Math.floor(TEXTURE_W / CELL)
  const rows = Math.floor(BAR_H / CELL)
  const dots = Array.from({ length: cols }, (_, c) =>
    Array.from({ length: rows }, (_, r) =>
      noise(c, r) < TEXTURE_DENSITY
        ? `<rect class="t${Math.floor(noise(r, c) * 4)}" x="${c * CELL + 1}" y="${r * CELL + 1}" width="2" height="2"/>`
        : '',
    ).join(''),
  ).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${TEXTURE_W}" height="${BAR_H}" viewBox="0 0 ${TEXTURE_W} ${BAR_H}"><style>
.t0,.t1,.t2,.t3{animation:tw ${view.isFinished ? 3.2 : 2.2}s ease-in-out infinite}
.t1{animation-duration:2.8s;animation-delay:-.7s}.t2{animation-duration:1.9s;animation-delay:-1.3s}.t3{animation-duration:3.3s;animation-delay:-.4s}
@keyframes tw{0%,100%{opacity:1}50%{opacity:${view.isFinished ? 0.8 : 0.3}}}
@media (prefers-reduced-motion: reduce){.t0,.t1,.t2,.t3{animation:none}}
</style><g data-part="bar" fill="${barColorOf(view)}">${dots}</g></svg>`
}

function pillSvg(view: RunView): string {
  const label = pillText(view)
  const W = pillWidthOf(label)
  return svg(
    W,
    BAR_H,
    `<g data-part="pill"><rect width="${W}" height="${BAR_H}" rx="${BAR_H / 2}" fill="${barColorOf(view)}"/>
<text x="${W / 2}" y="${BAR_H / 2 + 4}" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="600" fill="#ffffff">${xml(label)}</text></g>`,
  )
}

const TICK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${TICK_W}" height="${TICK_H}" viewBox="0 0 ${TICK_W} ${TICK_H}">${THEME_CSS}<rect class="sv-tk" width="${TICK_W}" height="${TICK_H}" rx="${TICK_W / 2}"/></svg>`

function dotSvg(view: RunView): string {
  const half = DOT_PX / 2
  return svg(
    DOT_PX,
    DOT_PX,
    `<circle${view.isFinished ? '' : ' class="sv-live"'} cx="${half}" cy="${half}" r="4" fill="${dotColorOf(view)}"/>`,
  )
}

function crabSvg(view: RunView): string {
  const lead = leadOf(view)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CRAB_W}" height="${CRAB_H}" viewBox="0 0 ${CRAB_W} ${CRAB_H}" role="img" aria-label="${xml(costumeOf(lead))} crab">
${CRAB_CSS}${crab(0, -1, costumeOf(lead), colorOf(lead), false, !view.isFinished, 0.8)}
</svg>`
}

const blockBar = (view: RunView, blocks: number) => {
  const filled = Math.round(blocks * progressOf(view))
  return `${'█'.repeat(filled)}${'░'.repeat(blocks - filled)}`
}

function terminalLine(view: RunView, plan: BandPlan, time: string): string {
  const lane = laneOf(view)
  const pill = pillText(view)
  const middle = plan.isBarShown ? `${blockBar(view, plan.barColumns - [...pill].length - 1)} ${pill}` : pill
  return [
    plan.isSlugShown ? DOT : null,
    plan.isSlugShown ? view.slug : null,
    plan.isLaneShown && lane !== null ? `[${lane}]` : null,
    middle,
    time,
  ]
    .filter((part): part is string => part !== null)
    .join(' ')
}

const isEnginePlaceholder = (drawn: unknown) =>
  typeof drawn !== 'object' || drawn === null || (drawn as { type?: unknown }).type === 'engine'

const isDismissed = (marker: string | null, view: RunView) => marker !== null && marker === activitySignature(view)

type BandElements = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button'>

type DesktopElements = BandElements & Pick<Elements['desktop'], 'Svg'>

async function copyName($: EngineInterface, slug: string, surface: UiPressArgument['surface']): Promise<void> {
  const copied = await $.ui.copy({ text: slug, surface })
  await $.ui.toast(copied.isCopied ? `Copied ${slug}` : COPY_FAILED)
}

function countButton($: EngineInterface, ui: BandElements, view: RunView): RenderElement {
  const { Button } = ui
  return (
    <Button key="spindle-crew" plain onPress={() => void togglePane($)}>
      {`×${workingOf(view).length}`}
    </Button>
  )
}

function dismissButton($: EngineInterface, ui: BandElements, view: RunView): RenderElement {
  const { Button } = ui
  return (
    <Button
      key="spindle-dismiss"
      plain
      role="dismiss"
      onPress={async () => {
        await update($, dismissedState, () => activitySignature(view))
      }}
    >
      {DISMISS}
    </Button>
  )
}

function progressBar(ui: DesktopElements, view: RunView): RenderElement {
  const { Box, Svg } = ui
  const share = progressOf(view)
  const pill = pillText(view)
  const ticks = STAGE_TABLE.map((_, k) => (
    <Box key={`spindle-tick-${k}`} width={0} flexGrow={1} flexDirection="row" alignItems="center">
      {k > 0 && k / STAGE_TABLE.length > share + 0.01 ? (
        <Svg source={TICK_SVG} alt="stage boundary" width={TICK_W} height={TICK_H} />
      ) : null}
    </Box>
  ))
  return (
    <Box key="spindle-bar" position="relative" flexDirection="row" flexGrow={1} minWidth={0} overflow="hidden" backgroundColor={TRACK}>
      <Box key="spindle-ticks" position="absolute" top={0} bottom={0} left={0} right={0} flexDirection="row">
        {ticks}
      </Box>
      <Box key="spindle-bar-filled" position="relative" flexGrow={share} flexDirection="row" justifyContent="flex-end" overflow="hidden">
        <Box key="spindle-texture" position="absolute" top={0} left={0}>
          <Svg source={barSvg(view)} alt={`${view.slug}: ${pill}`} width={TEXTURE_W} height={BAR_H} />
        </Box>
        <Svg key="spindle-pill" source={pillSvg(view)} alt={pill} width={pillWidthOf(pill)} height={BAR_H} />
      </Box>
      <Box key="spindle-bar-rest" width={0} flexGrow={1 - share} />
    </Box>
  )
}

function desktopBand(
  $: EngineInterface,
  ui: DesktopElements,
  view: RunView,
  room: { columns: number; now: number; below: RenderElement | null },
): RenderElement {
  const { Box, Button, Text, Svg } = ui
  const { columns, now, below } = room
  const lane = laneOf(view)
  const pill = pillText(view)
  const cards: readonly Card[] = [
    { scope: PROGRESS_SCOPE, lines: mspLinesOf(view, now) },
    { scope: STAGE_SCOPE, lines: [stageSummary(view)] },
    { scope: LANE_SCOPE, lines: view.lane === null ? [] : [LANE_MEANING[view.lane]] },
  ]
  const progress =
    columns >= BAR_COLUMNS
      ? [cardTrigger(ui, PROGRESS_SCOPE, progressBar(ui, view), 'grow')]
      : [
          cardTrigger(ui, PROGRESS_SCOPE, <Svg key="spindle-pill" source={pillSvg(view)} alt={`${view.slug}: ${pill}`} width={pillWidthOf(pill)} height={BAR_H} />),
          <Box key="spindle-spacer" flexGrow={1} />,
        ]
  return (
    <Box flexDirection="column">
      <Box key="spindle-row" flexDirection="row" alignItems="center" gap="sm">
        {cardTrigger(ui, STAGE_SCOPE, <Svg source={dotSvg(view)} alt={stageSummary(view)} width={DOT_PX} height={DOT_PX} />)}
        <Box key="spindle-slug-room" flexShrink={1} minWidth={0}>
          <Button key="spindle-slug" plain onPress={press => void copyName($, view.slug, press.surface)}>
            <Text wrap="truncate-end">{view.slug}</Text>
          </Button>
        </Box>
        {lane === null
          ? null
          : cardTrigger(ui, LANE_SCOPE, <Svg source={chipSvg(lane)} alt={`${lane} lane`} width={chipWidthOf(lane)} height={CHIP_H} />)}
        {progress}
        <Text dimColor tabular wrap="truncate">
          {elapsed(view.startedAt, now)}
        </Text>
        <Svg source={crabSvg(view)} alt={`${costumeOf(leadOf(view))} crab`} width={CRAB_W} height={CRAB_H} />
        {countButton($, ui, view)}
        {dismissButton($, ui, view)}
      </Box>
      {below}
      {cardSlot(ui, 'spindle-cards', cards, { top: -tallestCard(cards), left: 0 })}
    </Box>
  )
}

function terminalBand($: EngineInterface, ui: BandElements, view: RunView, room: { columns: number; now: number; below: RenderElement | null }) {
  const { Box, Button, Text } = ui
  const { columns, now, below } = room
  const time = elapsed(view.startedAt, now)
  const working = workingOf(view).length
  const lane = laneOf(view)
  const pill = pillText(view)
  const plan = planBand({
    columns,
    fixed: [DOT.length, time.length, `×${working}`.length, DISMISS.length],
    slug: [...view.slug].length,
    icon: ICON.length,
    lane: lane === null ? null : `[${lane}]`.length,
    pill: [...pill].length,
    barMin: [...pill].length + 1 + BAR_SPARE_COLUMNS,
  })
  const icon = hint(
    ui,
    'spindle-name-hint',
    <Button key="spindle-name" plain onPress={press => void copyName($, view.slug, press.surface)}>
      {ICON}
    </Button>,
    [nameHintOf(view), COPY_HINT],
  )
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" gap="sm">
        {plan.isSlugShown ? null : <Text>{DOT}</Text>}
        {plan.isSlugShown ? null : icon}
        <Text>{terminalLine(view, plan, time)}</Text>
        {hint(ui, 'spindle-crew-card', countButton($, ui, view), [countHintOf(working)], { edge: 'end' })}
        {hint(ui, 'spindle-dismiss-hint', dismissButton($, ui, view), [DISMISS_HINT], { edge: 'end' })}
      </Box>
      {below}
    </Box>
  )
}

export async function drawBand(
  $: EngineInterface,
  e: RenderInput<'AbovePrompt'>,
  beneath: () => Promise<RenderElement> | RenderElement,
): Promise<RenderElement> {
  const [view, dismissedAt, now] = await Promise.all([read($, viewState), read($, dismissedState), $.clock.now()])
  if (view === null || e.props.hasSurvey || isDismissed(dismissedAt, view)) return beneath()
  const drawn = await Promise.resolve(beneath()).catch(() => null)
  const below = isEnginePlaceholder(drawn) ? null : drawn
  const ui = $.ui.resolve(e)
  const room = { columns: e.props.bodyColumns || 100, now, below }
  if (e.surface === 'desktop' && 'Svg' in ui) return desktopBand($, ui, view, room)
  return terminalBand($, ui, view, room)
}
