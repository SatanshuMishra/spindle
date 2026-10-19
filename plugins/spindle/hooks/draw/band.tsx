import { atom, read, update } from 'claude-code'
import type { Elements, EngineInterface, RenderElement, RenderInput } from 'claude-code'

import type { Role, RunView } from '../../types'
import { LANE_NAME } from '../run/state'
import { activityNow, currentActivity, elapsed } from '../run/summary'
import { activitySignature } from '../run/view'
import { CRAB_CSS, colorOf, costumeOf, crab } from './crew'
import { hint } from './hint'
import { togglePane } from './pane'
import { ACCENT, CELL_PX, DONE, FONT, STAGE_TABLE, THEME_CSS, columnsOf, noise, stageIndex, stageInfo, xml } from './text'

const viewState = atom({ plugin: 'spindle', key: 'view' } as const, null)
const dismissedState = atom({ plugin: 'spindle', key: 'dismissedAt' } as const, null)

const BAR_H = 16
const CELL = 3
const CRAB_W = 24
const CRAB_H = 22
const CRAB_COLUMNS = CRAB_W / CELL_PX
const BAR_SPARE_COLUMNS = 12
const DOT = '●'
const ICON = '◉'
const DISMISS = '✕'
const DISMISS_HINT = 'Hide until an MSP moves to a new activity'

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

const barMinColumnsOf = (label: string) => Math.ceil(pillWidthOf(label) / CELL_PX) + BAR_SPARE_COLUMNS

const laneOf = (view: RunView) => (view.lane === null ? null : LANE_NAME[view.lane])

const nameHintOf = (view: RunView) => {
  const lane = laneOf(view)
  return lane === null ? view.slug : `${view.slug} · ${lane} lane`
}

const countHintOf = (working: number) => `Show the Pipeline pane · ${working} working now`

const mspLinesOf = (view: RunView, now: number): readonly string[] =>
  view.msps.map(msp => {
    const activity = currentActivity(msp)
    return `${msp.label}: ${activity === undefined ? 'status unknown' : activityNow(activity, now)}`
  })

const dotColorOf = (view: RunView) => (view.isFinished ? DONE : (stageInfo(view.stage)?.color ?? ACCENT))

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
  const isLaneShown = isBarShown && room.lane !== null && fits([...room.fixed, name, room.lane, room.barMin])
  const others = [...room.fixed, name, isLaneShown ? room.lane : null]
  const barColumns = isBarShown ? room.columns - rowColumns(others) - 1 : 0
  return { isSlugShown, isLaneShown, isBarShown, barColumns }
}

function barSvg(view: RunView, W: number): string {
  const color = view.isFinished ? DONE : ACCENT
  const fillW = Math.round(W * progressOf(view))
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
  const ticks = Array.from({ length: STAGE_TABLE.length - 1 }, (_, i) => Math.round((W * (i + 1)) / STAGE_TABLE.length))
    .filter(x => x > fillW + 4)
    .map(x => `<rect x="${x}" y="${BAR_H / 2 - 4}" width="1.5" height="8" rx=".75"/>`)
    .join('')
  const label = pillText(view)
  const pillW = pillWidthOf(label)
  const pillX = Math.max(0, Math.min(W - pillW, fillW - pillW))
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${BAR_H}" viewBox="0 0 ${W} ${BAR_H}" role="img" aria-label="${xml(view.slug)}: ${xml(label)}">
${THEME_CSS}<style>
.t0,.t1,.t2,.t3{animation:tw ${view.isFinished ? 3.2 : 2.2}s ease-in-out infinite}
.t1{animation-duration:2.8s;animation-delay:-.7s}.t2{animation-duration:1.9s;animation-delay:-1.3s}.t3{animation-duration:3.3s;animation-delay:-.4s}
@keyframes tw{0%,100%{opacity:1}50%{opacity:${view.isFinished ? 0.8 : 0.3}}}
@media (prefers-reduced-motion: reduce){.t0,.t1,.t2,.t3{animation:none}}
</style>
<defs><clipPath id="bc-${W}"><rect width="${W}" height="${BAR_H}" rx="${BAR_H / 2}"/></clipPath></defs>
<rect class="sv-k" width="${W}" height="${BAR_H}" rx="${BAR_H / 2}"/>
<g clip-path="url(#bc-${W})"><g fill="${color}">${dots}</g><g class="sv-tk">${ticks}</g></g>
<rect x="${pillX}" width="${pillW}" height="${BAR_H}" rx="${BAR_H / 2}" fill="${color}"/>
<text x="${pillX + pillW / 2}" y="${BAR_H / 2 + 4}" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="600" fill="#ffffff">${xml(label)}</text>
</svg>`
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
    DOT,
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

type Controls = { icon: RenderElement; count: RenderElement; dismiss: RenderElement }

function controlsOf($: EngineInterface, ui: BandElements, view: RunView): Controls {
  const { Button } = ui
  return {
    icon: hint(
      ui,
      'spindle-name-hint',
      <Button key="spindle-name" label={ICON} plain onPress={press => void $.ui.copy({ text: view.slug, surface: press.surface })} />,
      [nameHintOf(view)],
    ),
    count: <Button key="spindle-crew" label={`×${workingOf(view).length}`} plain onPress={() => void togglePane($)} />,
    dismiss: hint(
      ui,
      'spindle-dismiss-hint',
      <Button
        key="spindle-dismiss"
        label={DISMISS}
        plain
        role="dismiss"
        onPress={async () => {
          await update($, dismissedState, () => activitySignature(view))
        }}
      />,
      [DISMISS_HINT],
    ),
  }
}

export async function drawBand(
  $: EngineInterface,
  e: RenderInput<'AbovePrompt'>,
  beneath: () => Promise<RenderElement> | RenderElement,
): Promise<RenderElement> {
  const view = await read($, viewState)
  const dismissedAt = await read($, dismissedState)
  if (view === null || e.props.hasSurvey || isDismissed(dismissedAt, view)) return beneath()
  const drawn = await Promise.resolve(beneath()).catch(() => null)
  const below = isEnginePlaceholder(drawn) ? null : drawn
  const now = await $.clock.now()
  const time = elapsed(view.startedAt, now)
  const ui = $.ui.resolve(e)
  const { Box, Text } = ui
  const columns = e.props.bodyColumns || 100
  const working = workingOf(view).length
  const lane = laneOf(view)
  const pill = pillText(view)
  const mspLines = mspLinesOf(view, now)
  const controls = controlsOf($, ui, view)
  if (e.surface === 'desktop' && 'Svg' in ui) {
    const { Svg } = ui
    const plan = planBand({
      columns,
      fixed: [columnsOf(DOT), columnsOf(time), CRAB_COLUMNS, columnsOf(`×${working}`), columnsOf(DISMISS)],
      slug: columnsOf(view.slug),
      icon: columnsOf(ICON),
      lane: lane === null ? null : columnsOf(lane),
      pill: columnsOf(pill),
      barMin: barMinColumnsOf(pill),
    })
    const barW = plan.barColumns * CELL_PX
    const name = plan.isSlugShown
      ? hint(ui, 'spindle-slug-hint', <Text weight="medium">{view.slug}</Text>, [nameHintOf(view)])
      : controls.icon
    const progress = plan.isBarShown ? (
      <Svg source={barSvg(view, barW)} alt={`${view.slug}: ${pill}`} width={barW} height={BAR_H} />
    ) : (
      <Text color={view.isFinished ? DONE : ACCENT} weight="semibold">
        {pill}
      </Text>
    )
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Text color={dotColorOf(view)}>{DOT}</Text>
          {name}
          {plan.isLaneShown && lane !== null ? (
            <Text dimColor weight="semibold">
              {lane}
            </Text>
          ) : null}
          {hint(ui, 'spindle-progress-hint', progress, mspLines)}
          <Text dimColor tabular>
            {time}
          </Text>
          {hint(
            ui,
            'spindle-crew-card',
            [<Svg source={crabSvg(view)} alt={`${costumeOf(leadOf(view))} crab`} width={CRAB_W} height={CRAB_H} />, controls.count],
            [countHintOf(working)],
          )}
          {controls.dismiss}
        </Box>
        {below}
      </Box>
    )
  }
  const plan = planBand({
    columns,
    fixed: [DOT.length, time.length, `×${working}`.length, DISMISS.length],
    slug: [...view.slug].length,
    icon: ICON.length,
    lane: lane === null ? null : `[${lane}]`.length,
    pill: [...pill].length,
    barMin: [...pill].length + 1 + BAR_SPARE_COLUMNS,
  })
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" gap={1}>
        {plan.isSlugShown ? null : controls.icon}
        <Text>{terminalLine(view, plan, time)}</Text>
        {hint(ui, 'spindle-crew-card', controls.count, [countHintOf(working)])}
        {controls.dismiss}
      </Box>
      {below}
    </Box>
  )
}
