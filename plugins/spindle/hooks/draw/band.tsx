import { atom, read, update } from 'claude-code'
import type { Elements, EngineInterface, RenderElement, RenderInput, UiPressArgument } from 'claude-code'

import type { Lane, Role, RunView } from '../../types'
import { LANE_NAME } from '../run/state'
import { activityNow, currentActivity, elapsed } from '../run/summary'
import { activitySignature } from '../run/view'
import { CRAB_CSS, colorOf, costumeOf, crab } from './crew'
import { hint } from './hint'
import { stageSummary, togglePane } from './pane'
import { ACCENT, CELL_PX, CHIP_H, DONE, FONT, STAGE_TABLE, chipSvg, chipWidthOf, columnsOf, fluidSvg, noise, stageIndex, stageInfo, svg, xml } from './text'

const viewState = atom({ plugin: 'spindle', key: 'view' } as const, null)
const dismissedState = atom({ plugin: 'spindle', key: 'dismissedAt' } as const, null)
const copiedState = atom({ plugin: 'spindle', key: 'copiedName' } as const, null)

const BAR_H = 16
const CELL = 3
const CRAB_W = 24
const CRAB_H = 22
const CRAB_COLUMNS = CRAB_W / CELL_PX
const BAR_SPARE_COLUMNS = 12
const BAR_SPARE_PX = 96
const BAR_DOTS_REACH = 1.15
const BUTTON_CHROME = 2
const BAND_SPARE = 2
const MEDIUM_WIDTH = 1.06
const DOT_PX = 10
const DOT = '●'
const ICON = '◉'
const DISMISS = '✕'
const DISMISS_HINT = 'Hide until an MSP moves to a new activity'
const COPY_HINT = 'Press to copy the name'
const COPIED = 'Copied'
const COPIED_MS = 2000
const TIME_HINT = 'Time since the run started'
const COUNT_HINT = 'Show the Pipeline pane'
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

const pxColumns = (px: number) => Math.ceil(px / CELL_PX)

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

const percent = (share: number) => `${(Math.max(0, Math.min(1, share)) * 100).toFixed(2)}%`

function barSvg(view: RunView, plannedW: number): string {
  const color = view.isFinished ? DONE : ACCENT
  const share = progressOf(view)
  const reachW = Math.round(plannedW * BAR_DOTS_REACH * share)
  const cols = Math.floor(reachW / CELL)
  const rows = Math.floor(BAR_H / CELL)
  const dots = Array.from({ length: cols }, (_, c) => {
    const density = 0.35 + 0.6 * Math.pow(c / Math.max(1, cols), 1.2)
    return Array.from({ length: rows }, (_, r) =>
      noise(c, r) < density
        ? `<rect class="t${Math.floor(noise(r, c) * 4)}" x="${c * CELL + 1}" y="${r * CELL + 1}" width="2" height="2"/>`
        : '',
    ).join('')
  }).join('')
  const ticks = Array.from({ length: STAGE_TABLE.length - 1 }, (_, i) => (i + 1) / STAGE_TABLE.length)
    .filter(at => at > share + 0.01)
    .map(at => `<rect x="${percent(at)}" y="${BAR_H / 2 - 4}" width="1.5" height="8" rx=".75"/>`)
    .join('')
  const label = pillText(view)
  const pillW = pillWidthOf(label)
  const pill = `<rect x="${-pillW}" width="${pillW}" height="${BAR_H}" rx="${BAR_H / 2}" fill="${color}"/>
<text x="${-pillW / 2}" y="${BAR_H / 2 + 4}" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="600" fill="#ffffff">${xml(label)}</text>`
  const riding =
    plannedW * share >= pillW
      ? `<svg x="${percent(share)}" overflow="visible">${pill}</svg>`
      : `<svg x="${pillW}" overflow="visible">${pill}</svg>`
  return fluidSvg(
    BAR_H,
    `<style>
.t0,.t1,.t2,.t3{animation:tw ${view.isFinished ? 3.2 : 2.2}s ease-in-out infinite}
.t1{animation-duration:2.8s;animation-delay:-.7s}.t2{animation-duration:1.9s;animation-delay:-1.3s}.t3{animation-duration:3.3s;animation-delay:-.4s}
@keyframes tw{0%,100%{opacity:1}50%{opacity:${view.isFinished ? 0.8 : 0.3}}}
@media (prefers-reduced-motion: reduce){.t0,.t1,.t2,.t3{animation:none}}
</style>
<defs><clipPath id="track"><rect width="100%" height="${BAR_H}" rx="${BAR_H / 2}"/></clipPath><clipPath id="fill"><rect width="${percent(share)}" height="${BAR_H}"/></clipPath></defs>
<g data-part="bar"><rect class="sv-k" width="100%" height="${BAR_H}" rx="${BAR_H / 2}"/>
<g clip-path="url(#track)"><g fill="${color}" clip-path="url(#fill)">${dots}</g><g class="sv-tk">${ticks}</g></g>
${riding}</g>`,
  )
}

function pillSvg(view: RunView): string {
  const color = view.isFinished ? DONE : ACCENT
  const label = pillText(view)
  const W = pillWidthOf(label)
  return svg(
    W,
    BAR_H,
    `<g data-part="pill"><rect width="${W}" height="${BAR_H}" rx="${BAR_H / 2}" fill="${color}"/>
<text x="${W / 2}" y="${BAR_H / 2 + 4}" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="600" fill="#ffffff">${xml(label)}</text></g>`,
  )
}

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

type Controls = { slug: RenderElement; icon: RenderElement; count: RenderElement; dismiss: RenderElement }

async function copyName($: EngineInterface, slug: string, surface: UiPressArgument['surface']): Promise<void> {
  await $.ui.copy({ text: slug, surface })
  await update($, copiedState, () => slug)
  $.clock.after(COPIED_MS, () => {
    void update($, copiedState, current => (current === slug ? null : current))
  })
}

function controlsOf($: EngineInterface, ui: BandElements, view: RunView, isCopied: boolean): Controls {
  const { Button } = ui
  const nameLines = isCopied ? [COPIED] : [nameHintOf(view), COPY_HINT]
  return {
    slug: hint(
      ui,
      'spindle-slug-hint',
      <Button key="spindle-slug" plain onPress={press => void copyName($, view.slug, press.surface)}>
        {view.slug}
      </Button>,
      nameLines,
    ),
    icon: hint(
      ui,
      'spindle-name-hint',
      <Button key="spindle-name" plain onPress={press => void copyName($, view.slug, press.surface)}>
        {ICON}
      </Button>,
      nameLines,
    ),
    count: (
      <Button key="spindle-crew" plain onPress={() => void togglePane($)}>
        {`×${workingOf(view).length}`}
      </Button>
    ),
    dismiss: hint(
      ui,
      'spindle-dismiss-hint',
      <Button
        key="spindle-dismiss"
        plain
        role="dismiss"
        onPress={async () => {
          await update($, dismissedState, () => activitySignature(view))
        }}
      >
        {DISMISS}
      </Button>,
      [DISMISS_HINT],
      { edge: 'end' },
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
  const controls = controlsOf($, ui, view, (await read($, copiedState)) === view.slug)
  if (e.surface === 'desktop' && 'Svg' in ui) {
    const { Svg } = ui
    const pillW = pillWidthOf(pill)
    const plan = planBand({
      columns,
      fixed: [
        pxColumns(DOT_PX),
        columnsOf(time),
        CRAB_COLUMNS,
        columnsOf(`×${working}`) + BUTTON_CHROME,
        columnsOf(DISMISS) + BUTTON_CHROME,
        BAND_SPARE,
      ],
      slug: Math.ceil(columnsOf(view.slug) * MEDIUM_WIDTH) + BUTTON_CHROME,
      icon: columnsOf(ICON) + BUTTON_CHROME,
      lane: lane === null ? null : pxColumns(chipWidthOf(lane)),
      pill: pxColumns(pillW),
      barMin: pxColumns(pillW + BAR_SPARE_PX),
    })
    const name = plan.isSlugShown ? controls.slug : controls.icon
    const progress = plan.isBarShown
      ? hint(
          ui,
          'spindle-progress-hint',
          <Svg key="spindle-bar" source={barSvg(view, plan.barColumns * CELL_PX)} alt={`${view.slug}: ${pill}`} height={BAR_H} />,
          mspLines,
          { size: 'grow' },
        )
      : hint(
          ui,
          'spindle-progress-hint',
          <Svg key="spindle-pill" source={pillSvg(view)} alt={`${view.slug}: ${pill}`} width={pillW} height={BAR_H} />,
          mspLines,
        )
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" alignItems="center" gap="sm">
          {hint(ui, 'spindle-stage-hint', <Svg source={dotSvg(view)} alt={stageSummary(view)} width={DOT_PX} height={DOT_PX} />, [stageSummary(view)])}
          {name}
          {plan.isLaneShown && lane !== null && view.lane !== null
            ? hint(ui, 'spindle-lane-hint', <Svg source={chipSvg(lane)} alt={`${lane} lane`} width={chipWidthOf(lane)} height={CHIP_H} />, [LANE_MEANING[view.lane]])
            : null}
          {progress}
          {plan.isBarShown ? null : <Box key="spindle-spacer" flexGrow={1} />}
          {hint(
            ui,
            'spindle-time-hint',
            <Text dimColor tabular wrap="truncate">
              {time}
            </Text>,
            [TIME_HINT],
            { edge: 'end' },
          )}
          <Svg source={crabSvg(view)} alt={`${costumeOf(leadOf(view))} crab`} width={CRAB_W} height={CRAB_H} />
          {hint(ui, 'spindle-crew-card', controls.count, [countHintOf(working)], { edge: 'end' })}
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
      <Box flexDirection="row" gap="sm">
        {plan.isSlugShown ? null : <Text>{DOT}</Text>}
        {plan.isSlugShown ? null : controls.icon}
        <Text>{terminalLine(view, plan, time)}</Text>
        {hint(ui, 'spindle-crew-card', controls.count, [countHintOf(working)], { edge: 'end' })}
        {controls.dismiss}
      </Box>
      {below}
    </Box>
  )
}
