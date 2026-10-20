import { atom, read, update } from 'claude-code'
import type { Elements, EngineInterface, RenderElement, RenderInput } from 'claude-code'

import type { Activity, MspRow, MspStatus, Outcome, Role, RoundRow, RunView, WorkerRole, WorkerRow } from '../../types'
import { LANE_NAME } from '../run/state'
import { NO_RUN, activityNow, currentActivity, elapsed, modelName } from '../run/summary'
import { ROLE_COLOR, colorOf, costumeOf, crab } from './crew'
import { hint } from './hint'
import {
  ACCENT,
  CELL_PX,
  CHIP_H,
  DONE,
  FAIL,
  FONT,
  LANE_COLORS,
  STAGE_TABLE,
  chipSvg,
  chipWidthOf,
  columnsOf,
  fitText,
  fluidSvg,
  stageIndex,
  stageInfo,
  statusMark,
  svg,
  textWidth,
  xml,
} from './text'
import type { Mark, StageInfo } from './text'

export const PANE = 'spindle-run'
export const PANE_TITLE = 'Pipeline'

const viewState = atom({ plugin: 'spindle', key: 'view' } as const, null)
const selectedState = atom({ plugin: 'spindle', key: 'selectedMsp' } as const, null)

const TITLE = 'Pipeline Insights'
const COST_HINT = "Cost of this session's model calls"
const TIME_HINT = 'Time since the run started'
const PROOF_HINT = ['Acceptance test failed without the work (red)', 'and passed with it (green)']
const VERDICT_LEGEND = 'Red: blocker · yellow: advisory · grey: other candidate'
const SHOW_ALL = 'Show all'
const MAIN_THREAD = 'run by the main thread'
const RAIL_H = 44
const RAIL_LABEL_PX = 10.5
const RAIL_NAMES_COLUMNS = 60
const AVATAR_W = 44
const AVATAR_H = 36
const AVATAR_COLUMNS = Math.ceil(AVATAR_W / CELL_PX)
const MARK_PX = 14
const MARK_COLUMNS = Math.ceil(MARK_PX / CELL_PX)
const BUTTON_CHROME = 2
const HOTKEY_COLUMNS = 2
const MIN_ACTIVITY_COLUMNS = 6
const LANE_BAR_H = 6
const PROOF_PX = 10.5
const PROOF_WORD_W = Math.ceil(textWidth('proof', PROOF_PX)) + 4
const PROOF_W = PROOF_WORD_W + 26
const PROOF_H = 14
const CREW_CRAB_PX = 18
const WORKER_CRAB_PX = 32
const WORKER_CRAB_COLUMNS = WORKER_CRAB_PX / CELL_PX
const CONTEXT_W = 48
const CONTEXT_H = 4
const PIP = 8
const PIP_STEP = 10
const VERDICT_CHIP_H = 18
const MAX_HOTKEYS = 9
const FOOTNOTE_SHARE = 12 / 13

const ROLE_NAME: Readonly<Record<WorkerRole, string>> = {
  captain: 'Captain',
  scribe: 'Scribe',
  builder: 'Builder',
  detective: 'Detective',
  judge: 'Judge',
  courier: 'Courier',
  plain: 'Agent',
  diagnosis: 'Diagnosis',
  smoke: 'Smoke',
}

const ROLE_LOOK: Readonly<Record<WorkerRole, Role>> = {
  captain: 'captain',
  scribe: 'scribe',
  builder: 'builder',
  detective: 'detective',
  judge: 'judge',
  courier: 'courier',
  plain: 'plain',
  diagnosis: 'detective',
  smoke: 'courier',
}

const MSP_STATUS: Readonly<Record<MspStatus, { word: string; mark: Mark }>> = {
  planned: { word: 'Planned', mark: 'pending' },
  building: { word: 'Building', mark: 'running' },
  built: { word: 'Built', mark: 'done' },
  review: { word: 'In review', mark: 'running' },
  fixing: { word: 'Fixing', mark: 'running' },
  green: { word: 'Green', mark: 'done' },
  blocked: { word: 'Draft · blocked', mark: 'failed' },
  pr: { word: 'PR open', mark: 'done' },
  failed: { word: 'Failed', mark: 'failed' },
  unknown: { word: 'Unknown', mark: 'pending' },
}

const VERDICT_COLOR: Readonly<Record<Outcome, string>> = {
  green: DONE,
  loop: ACCENT,
  diagnose: ROLE_COLOR.verdict,
  blocked: FAIL,
  'hard-failure': FAIL,
  unknown: ROLE_COLOR.continuity,
}

type PaneElements = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button'>

function cut(text: string, columns: number): string {
  if (columnsOf(text) <= columns) return text
  const chars = [...text]
  const kept = chars.findIndex((_, i) => columnsOf(chars.slice(0, i + 1).join('') + '…') > columns)
  return chars.slice(0, kept === -1 ? chars.length : kept).join('') + '…'
}

const laneWordOf = (view: RunView) => (view.lane === null ? null : `${LANE_NAME[view.lane]} lane`)

const stageName = (view: RunView) => (view.isFinished ? 'Done' : (stageInfo(view.stage)?.name ?? '?'))

const costText = (view: RunView) => `~$${view.costUsd.toFixed(2)}`

const isCrew = (worker: WorkerRow) => worker.role !== 'captain'

const liveCrewOf = (view: RunView) => view.workers.filter(worker => worker.isLive && isCrew(worker))

const agentsHint = (view: RunView) =>
  `Workers running now · ${view.workers.filter(isCrew).length} this run`

const mspsAt = (view: RunView, stage: StageInfo) => view.msps.filter(msp => msp.stage === stage.id).length

export const stageSummary = (view: RunView) => {
  const counts = STAGE_TABLE.filter(stage => mspsAt(view, stage) > 0).map(stage => `${mspsAt(view, stage)} at ${stage.name}`)
  return counts.length === 0 ? `Stage ${stageName(view)}` : `Stage ${stageName(view)} · ${counts.join(', ')}`
}

const currentIndexOf = (view: RunView) => (view.isFinished ? STAGE_TABLE.length : stageIndex(view.stage))

function railLines(view: RunView): readonly string[] {
  const current = currentIndexOf(view)
  return STAGE_TABLE.map((stage, i) => {
    const count = mspsAt(view, stage)
    const state = current === -1 ? '' : i < current ? 'done' : i === current ? 'now' : ''
    const msps = count === 0 ? '' : `${count} ${count === 1 ? 'MSP' : 'MSPs'}`
    return [stage.name, state, msps].filter(part => part !== '').join(' · ')
  })
}

const mspStatusText = (msp: MspRow) => {
  const word = MSP_STATUS[msp.status].word
  if (msp.pr !== '') return `${word} ${msp.pr}`
  return msp.round > 0 ? `${word} · R${msp.round}` : word
}

const activityText = (msp: MspRow, now: number) => {
  const activity = currentActivity(msp)
  return activity === undefined ? 'status unknown' : activityNow(activity, now)
}

const mspLabel = (msp: MspRow, now: number) => `${msp.label} · ${activityText(msp, now)}`

const laneColorOf = (i: number) => LANE_COLORS[i % LANE_COLORS.length] ?? ACCENT

const lanesDoneShare = (msp: MspRow) => (msp.lanesTotal > 0 ? Math.min(1, msp.lanesDone / msp.lanesTotal) : 0)

const proofMarks = (msp: MspRow) =>
  msp.proof === null ? '' : `proof ${msp.proof.isRedSeen ? '●' : '○'}${msp.proof.isGreenSeen ? '●' : '○'}`

const proofWords = (msp: MspRow) =>
  `Proof: ${msp.proof?.isRedSeen ? 'failed without the work' : 'without the work not seen yet'}, ${msp.proof?.isGreenSeen ? 'passed with it' : 'with the work not seen yet'}`

const proofVerdict = (msp: MspRow) =>
  msp.proof?.isRedSeen && msp.proof.isGreenSeen ? 'Both seen: the work is proven' : 'Not proven yet'

const lanesWords = (msp: MspRow) => `${msp.lanesDone} of ${msp.lanesTotal} lanes built`

const selectedOf = (view: RunView, stored: string | null) =>
  stored !== null && view.msps.some(msp => msp.label === stored) ? stored : null

const roundOrder = (worker: WorkerRow) => worker.round ?? Number.NEGATIVE_INFINITY

function listedWorkers(view: RunView, selected: string | null): readonly WorkerRow[] {
  if (selected === null) return view.workers.filter(worker => worker.isLive)
  const own = view.workers.filter(worker => worker.msp === selected)
  const finished = own.filter(worker => !worker.isLive)
  const newestFirst = [...finished].sort((a, b) => roundOrder(b) - roundOrder(a))
  return [...own.filter(worker => worker.isLive), ...newestFirst]
}

const workingTitle = (selected: string | null) => (selected === null ? 'Working now' : `${selected} · workers`)

const rightText = (worker: WorkerRow, now: number) =>
  [
    worker.model === null ? '' : modelName(worker.model),
    worker.isLive && worker.startedAt !== null ? elapsed(worker.startedAt, now) : '',
  ]
    .filter(part => part !== '')
    .join(' · ')

const contextPercent = (worker: WorkerRow) => Math.round((worker.contextShare ?? 0) * 100)

const contextHint = (worker: WorkerRow) => `Context ${contextPercent(worker)}%`

const roundOf = (view: RunView, worker: WorkerRow): RoundRow | undefined =>
  view.rounds.find(round => round.n === worker.round && round.msp === worker.msp)

const roundActivityOf = (view: RunView, worker: WorkerRow): Activity | undefined =>
  view.msps
    .find(msp => msp.label === worker.msp)
    ?.activities.find(activity => activity.kind === 'round' && activity.round === worker.round)

const firstKindOf = (view: RunView, worker: WorkerRow): string | undefined => roundActivityOf(view, worker)?.kinds[0]

const isVerdictRow = (view: RunView, worker: WorkerRow) =>
  worker.role === 'judge' && !worker.isLive && roundOf(view, worker) !== undefined

const verdictWords = (worker: WorkerRow) => `Round ${worker.round ?? '?'}`

const workerKey = (worker: WorkerRow, i: number) => `worker-${worker.msp ?? 'run'}-${i}`

function railSvg(W: number, view: RunView, isEveryName: boolean): string {
  const count = STAGE_TABLE.length
  const half = (i: number) => textWidth(STAGE_TABLE[i]?.name ?? '', RAIL_LABEL_PX) / 2 + 1
  const left = Math.max(12, half(0))
  const right = W - Math.max(12, half(count - 1))
  const step = (right - left) / (count - 1)
  const current = currentIndexOf(view)
  const nodes = STAGE_TABLE.map((stage, i) => {
    const x = left + i * step
    const status: Mark = current === -1 ? 'pending' : i < current ? 'done' : i === current ? 'running' : 'pending'
    const mark =
      status === 'done'
        ? `<circle cx="${x}" cy="12" r="7" fill="${DONE}"/><path d="M${x - 3.2} 12l2.2 2.2 4.2-4.6" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`
        : status === 'running'
          ? `<circle class="sv-live" cx="${x}" cy="12" r="10" fill="${stage.color}" opacity=".25"/><circle cx="${x}" cy="12" r="6" fill="${stage.color}"/>`
          : `<circle cx="${x}" cy="12" r="5" class="sv-k sv-mstroke" stroke-width="1.2"/>`
    const labelX = Math.min(W - half(i), Math.max(half(i), x))
    const label =
      isEveryName || status === 'running'
        ? `<text ${status === 'running' ? `fill="${stage.color}" font-weight="600"` : `class="${status === 'pending' ? 'sv-m' : 'sv-t'}"`} x="${labelX}" y="36" text-anchor="middle" font-family="${FONT}" font-size="${RAIL_LABEL_PX}">${xml(stage.name)}</text>`
        : ''
    return `${mark}${label}`
  })
  const doneX = left + Math.max(0, Math.min(current, count - 1)) * step
  return svg(
    W,
    RAIL_H,
    `<rect class="sv-k" x="${left}" y="11" width="${right - left}" height="2" rx="1"/><rect x="${left}" y="11" width="${Math.max(0, doneX - left)}" height="2" rx="1" fill="${DONE}"/>${nodes.join('')}`,
    [stageSummary(view), ...railLines(view)],
  )
}

function avatarSvg(msp: MspRow, i: number, lines: readonly string[], isSelected: boolean): string {
  const { mark } = MSP_STATUS[msp.status]
  const isWorking = currentActivity(msp)?.isRunning ?? false
  return svg(
    AVATAR_W,
    AVATAR_H,
    `${isSelected ? `<rect data-selected="true" x="6" y="0" width="${AVATAR_W - 6}" height="${AVATAR_H}" rx="7" fill="none" stroke="${laneColorOf(i)}" stroke-width="2"/>` : ''}<rect x="0" y="0" width="3" height="${AVATAR_H}" rx="1.5" fill="${laneColorOf(i)}"/>
${crab(8, 1, 'builder', laneColorOf(i), mark === 'pending', isWorking, 1.1)}`,
    lines,
  )
}

function markSvg(msp: MspRow, i: number): string {
  const half = MARK_PX / 2
  return svg(MARK_PX, MARK_PX, statusMark(half, half, MSP_STATUS[msp.status].mark, laneColorOf(i)))
}

function laneBarSvg(msp: MspRow, i: number): string {
  const fill = MSP_STATUS[msp.status].mark === 'failed' ? FAIL : laneColorOf(i)
  const share = (lanesDoneShare(msp) * 100).toFixed(2)
  return fluidSvg(
    LANE_BAR_H,
    `<rect class="sv-k" x="0" y="1" width="100%" height="4" rx="2"/>
<rect x="0" y="1" width="${share}%" height="4" rx="2" fill="${fill}"/>`,
  )
}

function proofSvg(msp: MspRow): string {
  const x = PROOF_WORD_W
  const red = msp.proof?.isRedSeen
    ? `<circle cx="${x + 5}" cy="7" r="3.5" fill="${FAIL}"/>`
    : `<circle cx="${x + 5}" cy="7" r="3.5" fill="none" class="sv-mstroke" stroke-width="1.2"/>`
  const green = msp.proof?.isGreenSeen
    ? `<circle cx="${x + 21}" cy="7" r="3.5" fill="${DONE}"/>`
    : `<circle cx="${x + 21}" cy="7" r="3.5" fill="none" class="sv-mstroke" stroke-width="1.2"/>`
  return svg(
    PROOF_W,
    PROOF_H,
    `<text class="sv-m" x="0" y="10" font-family="${FONT}" font-size="${PROOF_PX}">proof</text>${red}<path d="M${x + 10} 7h6" class="sv-mstroke" stroke-width="1.2"/>${green}`,
    [...PROOF_HINT, proofVerdict(msp)],
  )
}

function crabSvg(px: number, role: Role, isWalking: boolean, isDim: boolean): string {
  return svg(px, px, crab(0, 0, costumeOf(role), colorOf(role), isDim, isWalking, px / 30))
}

function contextSvg(worker: WorkerRow): string {
  return svg(
    CONTEXT_W,
    CONTEXT_H,
    `<rect class="sv-k" x="0" y="0" width="${CONTEXT_W}" height="${CONTEXT_H}" rx="2"/>
<rect x="0" y="0" width="${Math.round((CONTEXT_W * contextPercent(worker)) / 100)}" height="${CONTEXT_H}" rx="2" class="sv-mfill"/>`,
    [contextHint(worker), ...(worker.model === null ? [] : [modelName(worker.model)])],
  )
}

const VERDICT_CHIP_PAD = 18
const CHIP_GAP = 6
const PIP_ROW_GAP = 4

type Spot = { x: number; y: number }

type VerdictLayout = { W: number; H: number; chip: Spot & { w: number; word: string }; pips: readonly Spot[] }

const pipsSpan = (count: number) => (count === 0 ? 0 : count * PIP_STEP - (PIP_STEP - PIP))

const pipsPerRow = (room: number) => Math.max(0, Math.floor((room + PIP_STEP - PIP) / PIP_STEP))

const pipGrid = (count: number, perRow: number, top: number): Spot[] =>
  Array.from({ length: count }, (_, i) => ({ x: (i % perRow) * PIP_STEP, y: top + Math.floor(i / perRow) * PIP_STEP }))

function verdictLayout(maxW: number, round: RoundRow): VerdictLayout {
  const chipW = Math.min(maxW, Math.ceil(textWidth(round.outcome, 11) + VERDICT_CHIP_PAD))
  const word = fitText(round.outcome, 11, chipW - VERDICT_CHIP_PAD)
  const candidates = Math.max(round.candidates ?? 0, round.blockers + round.advisories)
  const beside = pipsPerRow(maxW - chipW - CHIP_GAP)
  if (candidates === 0) return { W: chipW, H: VERDICT_CHIP_H, chip: { x: 0, y: 0, w: chipW, word }, pips: [] }
  if (beside >= 1) {
    const rows = Math.ceil(candidates / beside)
    const top = rows === 1 ? (VERDICT_CHIP_H - PIP) / 2 : 0
    const pips = pipGrid(candidates, beside, top)
    const chipX = pipsSpan(Math.min(candidates, beside)) + CHIP_GAP
    return { W: chipX + chipW, H: Math.max(VERDICT_CHIP_H, pipsSpan(rows)), chip: { x: chipX, y: 0, w: chipW, word }, pips }
  }
  const below = Math.max(1, pipsPerRow(maxW))
  const rows = Math.ceil(candidates / below)
  const top = VERDICT_CHIP_H + PIP_ROW_GAP
  const pips = pipGrid(candidates, below, top)
  return {
    W: Math.max(chipW, pipsSpan(Math.min(candidates, below))),
    H: top + pipsSpan(rows),
    chip: { x: 0, y: 0, w: chipW, word },
    pips,
  }
}

function verdictSvg(layout: VerdictLayout, round: RoundRow, tipLines: readonly string[]): string {
  const { W, H, chip } = layout
  const pips = layout.pips.map(({ x, y }, i) => {
    const kind = i < round.blockers ? 'blocker' : i < round.blockers + round.advisories ? 'advisory' : 'other'
    const paint =
      kind === 'blocker' ? `fill="${FAIL}"` : kind === 'advisory' ? `fill="${ROLE_COLOR.verdict}"` : 'class="sv-k"'
    return `<rect data-pip="${kind}" x="${x}" y="${y}" width="${PIP}" height="${PIP}" rx="2" ${paint}/>`
  }).join('')
  return svg(
    W,
    H,
    `${pips}<rect x="${chip.x}" y="${chip.y}" width="${chip.w}" height="${VERDICT_CHIP_H}" rx="9" fill="${VERDICT_COLOR[round.outcome]}"/>
<text x="${chip.x + chip.w / 2}" y="${chip.y + 12.5}" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="600" fill="#fff">${xml(chip.word)}</text>`,
    tipLines,
  )
}

export async function togglePane($: EngineInterface): Promise<string> {
  const panes = await $.ui.panes()
  if (panes.some(pane => pane.id === PANE)) {
    await $.ui.close({ id: PANE })
    return 'Run pane closed.'
  }
  await $.ui.open({ id: PANE, title: PANE_TITLE })
  return 'Run pane opened.'
}

async function toggleSelection($: EngineInterface, label: string): Promise<void> {
  await update($, selectedState, current => (current === label ? null : label))
}


async function clearSelection($: EngineInterface): Promise<void> {
  await update($, selectedState, () => null)
}

const hotkeyOf = (i: number) => (i < MAX_HOTKEYS ? { hotkey: String(i + 1) } : {})

type ButtonWords = { name: string; activity: string }

function buttonWords(msp: MspRow, i: number, columns: number, now: number): ButtonWords {
  const room = columns - AVATAR_COLUMNS - 1 - MARK_COLUMNS - 1 - BUTTON_CHROME - (i < MAX_HOTKEYS ? HOTKEY_COLUMNS : 0)
  const name = cut(msp.label, Math.max(4, room))
  const left = room - columnsOf(name) - 1
  return { name, activity: left >= MIN_ACTIVITY_COLUMNS ? cut(activityText(msp, now), left) : '' }
}

function desktopMspButton($: EngineInterface, ui: PaneElements, msp: MspRow, i: number, words: ButtonWords, isSelected: boolean) {
  const { Button, Text } = ui
  const parts = [
    ...(i < MAX_HOTKEYS ? [<Text dimColor mono size="caption">{String(i + 1)}</Text>, ' '] : []),
    <Text weight="semibold" wrap="truncate-end" {...(isSelected ? { color: ACCENT } : {})}>
      {words.name}
    </Text>,
    ...(words.activity === '' ? [] : [' ', <Text dimColor={!isSelected} size="footnote" wrap="truncate-end">{words.activity}</Text>]),
  ]
  return (
    <Button
      key={`msp-${msp.label}`}
      plain
      {...hotkeyOf(i)}
      onPress={async () => {
        await toggleSelection($, msp.label)
      }}
    >
      {parts}
    </Button>
  )
}

function terminalMspButton($: EngineInterface, ui: PaneElements, msp: MspRow, i: number, now: number) {
  const { Button } = ui
  return (
    <Button
      key={`msp-${msp.label}`}
      plain
      {...hotkeyOf(i)}
      onPress={async () => {
        await toggleSelection($, msp.label)
      }}
    >
      {mspLabel(msp, now)}
    </Button>
  )
}

function workingHeading($: EngineInterface, ui: PaneElements, selected: string | null, count: number) {
  const { Box, Button, Text } = ui
  if (selected === null) {
    return (
      <Box key="working-heading" flexDirection="row" gap="sm">
        <Text dimColor>{workingTitle(selected)}</Text>
        <Text dimColor>{`· ${count}`}</Text>
      </Box>
    )
  }
  return (
    <Box key="working-heading" flexDirection="row" alignItems="center" justifyContent="space-between" gap="sm">
      <Box key="working-title" flexShrink={1} minWidth={0}>
        <Text weight="semibold" wrap="truncate-end">
          {workingTitle(selected)}
        </Text>
      </Box>
      <Button
        key="show-all"
        plain
        dimColor
        onPress={async () => {
          await clearSelection($)
        }}
      >
        {SHOW_ALL}
      </Button>
    </Box>
  )
}

const roundHeading = (worker: WorkerRow) => (worker.round === null ? 'Build' : `Round ${worker.round}`)

type Room = { columns: number; now: number }

type DesktopElements = PaneElements & Pick<Elements['desktop'], 'Svg'>

function desktopPane($: EngineInterface, ui: DesktopElements, view: RunView, selected: string | null, room: Room) {
  const { Box, Text, Svg } = ui
  const { columns, now } = room
  const time = elapsed(view.startedAt, now)
  const lane = laneWordOf(view)
  const slugColumns = Math.max(4, columns - (lane === null ? 0 : Math.ceil(chipWidthOf(lane) / CELL_PX) + 1))
  const slug = cut(view.slug, slugColumns)
  const railW = Math.max(CELL_PX, Math.min(900, (columns - 2) * CELL_PX))
  const live = liveCrewOf(view)
  const crewRole = ROLE_LOOK[live[0]?.role ?? 'captain']
  const tile = (key: string, name: string, value: RenderElement, lines: readonly string[], edge: 'start' | 'end' = 'start') =>
    hint(
      ui,
      key,
      <Box flexDirection="column" flexGrow={1} minWidth={0} borderStyle="round" borderDimColor paddingX={1}>
        <Text dimColor size="caption">
          {name}
        </Text>
        {value}
      </Box>,
      lines,
      { size: 'grow', edge },
    )
  const mspRow = (msp: MspRow, i: number) => {
    const words = buttonWords(msp, i, columns, now)
    const lines = [mspLabel(msp, now), msp.branch, mspStatusText(msp), lanesWords(msp)]
    return (
      <Box key={`msp-row-${msp.label}`} flexDirection="row" alignItems="center" gap="sm">
        <Svg key={`msp-avatar-${msp.label}`} source={avatarSvg(msp, i, lines, msp.label === selected)} alt={`${msp.label} crab`} width={AVATAR_W} height={AVATAR_H} isInteractive />
        <Box key={`msp-main-${msp.label}`} flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>
          <Box key={`msp-line-${msp.label}`} flexDirection="row" alignItems="center" gap="sm">
            <Box key={`msp-press-${msp.label}`} flexGrow={1} flexShrink={1} minWidth={0}>
              {desktopMspButton($, ui, msp, i, words, msp.label === selected)}
            </Box>
            <Svg key={`msp-mark-${msp.label}`} source={markSvg(msp, i)} alt={`${msp.label}: ${MSP_STATUS[msp.status].word}`} width={MARK_PX} height={MARK_PX} />
          </Box>
          <Box key={`msp-lanes-${msp.label}`} flexDirection="row" alignItems="center" gap="sm">
            <Box key={`msp-bar-${msp.label}`} flexGrow={1} flexShrink={1} minWidth={0}>
              <Svg source={laneBarSvg(msp, i)} alt={`${msp.label}: ${lanesWords(msp)}`} height={LANE_BAR_H} />
            </Box>
            {msp.proof === null ? null : (
              <Svg key={`msp-proof-${msp.label}`} source={proofSvg(msp)} alt={proofWords(msp)} width={PROOF_W} height={PROOF_H} isInteractive />
            )}
          </Box>
        </Box>
      </Box>
    )
  }
  const listed = listedWorkers(view, selected)
  const rightColumns = Math.max(
    0,
    ...listed.map(worker => columnsOf(rightText(worker, now))),
    ...listed.map(worker => (worker.contextShare === null ? 0 : CONTEXT_W / CELL_PX)),
  )
  const wordsColumns = Math.max(4, columns - WORKER_CRAB_COLUMNS - 1 - rightColumns - 1)
  const workerRow = (worker: WorkerRow, i: number) => {
    const key = workerKey(worker, i)
    const role = ROLE_LOOK[worker.role]
    const round = isVerdictRow(view, worker) ? roundOf(view, worker) : undefined
    const kind = round === undefined ? undefined : firstKindOf(view, worker)
    const words = round === undefined ? worker.words : verdictWords(worker)
    const isCut = columnsOf(words) * FOOTNOTE_SHARE > wordsColumns
    const right = rightText(worker, now)
    const layout = round === undefined ? undefined : verdictLayout(wordsColumns * CELL_PX, round)
    return (
      <Box key={key} flexDirection="row" alignItems="center" gap="sm">
        <Svg
          key={`${key}-crab`}
          source={crabSvg(WORKER_CRAB_PX, role, worker.isLive, !worker.isLive)}
          alt={`${ROLE_NAME[worker.role]} crab`}
          width={WORKER_CRAB_PX}
          height={WORKER_CRAB_PX}
        />
        <Box key={`${key}-words`} flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>
          <Text weight="semibold" wrap="truncate-end">
            {ROLE_NAME[worker.role]}
          </Text>
          {hint(
            ui,
            `${key}-words-hint`,
            <Text dimColor size="footnote" wrap="truncate-end">
              {words}
            </Text>,
            isCut ? [words] : [],
            { side: 'below', size: 'shrink' },
          )}
          {round === undefined || layout === undefined ? null : (
            <Svg
              key={`${key}-verdict`}
              source={verdictSvg(layout, round, [worker.words, ...(roundActivityOf(view, worker)?.summary ?? []), VERDICT_LEGEND])}
              alt={worker.words}
              width={layout.W}
              height={layout.H}
              isInteractive
            />
          )}
          {kind === undefined ? null : (
            <Text size="footnote" wrap="truncate-end">
              {kind}
            </Text>
          )}
        </Box>
        <Box key={`${key}-right`} flexDirection="column" alignItems="flex-start" width={rightColumns} flexShrink={0}>
          {right === '' ? null : (
            <Text dimColor size="footnote" tabular>
              {right}
            </Text>
          )}
          {worker.contextShare === null ? null : (
            <Svg source={contextSvg(worker)} alt={contextHint(worker)} width={CONTEXT_W} height={CONTEXT_H} isInteractive />
          )}
        </Box>
      </Box>
    )
  }
  const selectedMsp = view.msps.find(msp => msp.label === selected)
  const isMainThreadOnly = selectedMsp !== undefined && !listed.some(worker => worker.isLive)
  const workerRows = listed.flatMap((worker, i) => {
    const previous = listed[i - 1]
    const isNewRound = selected !== null && !worker.isLive && (previous === undefined || previous.isLive || previous.round !== worker.round)
    return [
      ...(isNewRound
        ? [
            <Text key={`round-head-${worker.round ?? 'build'}`} dimColor size="caption" weight="semibold">
              {roundHeading(worker)}
            </Text>,
          ]
        : []),
      workerRow(worker, i),
    ]
  })
  return (
    <Box flexDirection="column" gap="md">
      <Box key="pane-title" flexDirection="column">
        <Text weight="bold" size="heading">
          {TITLE}
        </Text>
        <Box key="pane-thread" flexDirection="row" alignItems="center" gap="sm">
          {hint(
            ui,
            'pane-slug-hint',
            <Text dimColor wrap="truncate-end">
              {slug}
            </Text>,
            [view.slug],
            { side: 'below', size: 'shrink' },
          )}
          {lane === null ? null : <Svg key="pane-lane" source={chipSvg(lane)} alt={lane} width={chipWidthOf(lane)} height={CHIP_H} />}
        </Box>
      </Box>
      <Box key="pane-tiles" flexDirection="row" gap="sm">
        {tile('tile-cost', 'Cost', <Text weight="semibold" tabular wrap="truncate-end">{costText(view)}</Text>, [COST_HINT])}
        {tile(
          'tile-agents',
          'Agents',
          <Box flexDirection="row" alignItems="center" gap="xs">
            <Svg source={crabSvg(CREW_CRAB_PX, crewRole, true, false)} alt={`${costumeOf(crewRole)} crab`} width={CREW_CRAB_PX} height={CREW_CRAB_PX} />
            <Text weight="semibold" tabular>
              {String(live.length)}
            </Text>
          </Box>,
          [agentsHint(view)],
        )}
        {tile('tile-time', 'Time', <Text weight="semibold" tabular wrap="truncate-end">{time}</Text>, [TIME_HINT], 'end')}
      </Box>
      <Svg
        key="pane-rail"
        source={railSvg(railW, view, columns >= RAIL_NAMES_COLUMNS)}
        alt={stageSummary(view)}
        width={railW}
        height={RAIL_H}
        isInteractive
      />
      <Box key="pane-msps" flexDirection="column" gap="xs">
        <Text dimColor>{`MSPs · ${view.msps.length}`}</Text>
        {view.msps.map(mspRow)}
      </Box>
      <Box key="pane-workers" flexDirection="column" gap="xs">
        {workingHeading($, ui, selected, listed.length)}
        {isMainThreadOnly && selectedMsp !== undefined ? (
          <Text key="main-thread-note" dimColor size="footnote">{`${activityText(selectedMsp, now)} · ${MAIN_THREAD}`}</Text>
        ) : null}
        {workerRows}
      </Box>
    </Box>
  )
}

const terminalWorkerLine = (view: RunView, worker: WorkerRow, now: number) => {
  const round = isVerdictRow(view, worker) ? roundOf(view, worker) : undefined
  const verdict =
    round === undefined
      ? ''
      : `${round.outcome} · ${round.blockers} blockers, ${round.advisories} advisories${firstKindOf(view, worker) === undefined ? '' : ` · ${firstKindOf(view, worker)}`}`
  return [
    ROLE_NAME[worker.role],
    round === undefined ? worker.words : verdictWords(worker),
    verdict,
    rightText(worker, now),
    worker.contextShare === null ? '' : `context ${contextPercent(worker)}%`,
  ]
    .filter(part => part !== '')
    .join('  ')
}

function terminalPane($: EngineInterface, ui: PaneElements, view: RunView, selected: string | null, now: number) {
  const { Box, Text } = ui
  const time = elapsed(view.startedAt, now)
  const lane = laneWordOf(view)
  const listed = listedWorkers(view, selected)
  const mspExtra = (msp: MspRow) =>
    [`${msp.lanesDone}/${msp.lanesTotal}`, proofMarks(msp), mspStatusText(msp)].filter(part => part !== '').join('  ')
  return (
    <Box flexDirection="column">
      <Text bold>{TITLE}</Text>
      <Text>{lane === null ? view.slug : `${view.slug}  [${lane}]`}</Text>
      <Text>{`Cost ${costText(view)}  ·  Agents ${liveCrewOf(view).length}  ·  Time ${time}`}</Text>
      <Text>{stageSummary(view)}</Text>
      <Text dimColor>{`MSPs · ${view.msps.length}`}</Text>
      {view.msps.map((msp, i) => (
        <Box key={`msp-row-${msp.label}`} flexDirection="row" gap={1}>
          {terminalMspButton($, ui, msp, i, now)}
          <Text dimColor>{mspExtra(msp)}</Text>
        </Box>
      ))}
      {workingHeading($, ui, selected, listed.length)}
      {listed.map((worker, i) => (
        <Text key={workerKey(worker, i)}>{terminalWorkerLine(view, worker, now)}</Text>
      ))}
    </Box>
  )
}

export async function drawPane($: EngineInterface, e: RenderInput<'Pane'>) {
  const ui = $.ui.resolve(e)
  const { Box, Text } = ui
  const view = await read($, viewState)
  if (view === null) {
    return (
      <Box flexDirection="column">
        <Text dimColor>{NO_RUN}</Text>
      </Box>
    )
  }
  const now = await $.clock.now()
  const selected = selectedOf(view, await read($, selectedState))
  if (e.surface === 'desktop' && 'Svg' in ui) {
    return desktopPane($, ui, view, selected, { columns: e.props.bodyColumns || 60, now })
  }
  return terminalPane($, ui, view, selected, now)
}
