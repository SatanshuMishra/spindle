import { atom, read, update } from 'claude-code'
import type { Elements, EngineInterface, RenderElement, RenderInput } from 'claude-code'

import type { Activity, MspRow, MspStatus, Outcome, Role, RoundRow, RunView, WorkerRole, WorkerRow } from '../../types'
import { LANE_NAME } from '../run/state'
import { NO_RUN, activityNow, currentActivity, elapsed, modelName, unplannedPulls } from '../run/summary'
import { ROLE_COLOR, colorOf, costumeOf, crab } from './crew'
import { cardSlot, cardTrigger } from './hint'
import type { Card } from './hint'
import {
  ACCENT,
  CELL_PX,
  CHIP_H,
  DONE,
  FAIL,
  FONT,
  LANE_COLORS,
  STAGE_TABLE,
  TRACK,
  chipSvg,
  chipWidthOf,
  columnsOf,
  fitText,
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
const PROOF_HINT = ['Acceptance test failed without the work (red)', 'and passed with it (green)']
const VERDICT_LEGEND = 'Red: blocker · yellow: advisory · grey: other candidate'
const MAIN_THREAD = 'run by the main thread'
const RAIL_NAMES_COLUMNS = 60
const RAIL_MARK = 24
const STRIP_W = 1600
const LINK_H = 2
const LANE_BAR_H = 4
const VERDICT_ROOM = 200
const AVATAR_W = 44
const AVATAR_H = 36
const MARK_PX = 14
const PROOF_PX = 10.5
const PROOF_WORD_W = Math.ceil(textWidth('proof', PROOF_PX)) + 4
const PROOF_W = PROOF_WORD_W + 26
const PROOF_H = 14
const CREW_CRAB_PX = 18
const WORKER_CRAB_PX = 32
const CONTEXT_W = 48
const CONTEXT_H = 4
const PIP = 8
const PIP_STEP = 10
const VERDICT_CHIP_H = 18
const MAX_HOTKEYS = 9

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

const laneWordOf = (view: RunView) => (view.lane === null ? null : `${LANE_NAME[view.lane]} lane`)

const stageName = (view: RunView) => (view.isFinished ? 'Done' : (stageInfo(view.stage)?.name ?? '?'))

const costText = (view: RunView) => `~$${view.costUsd.toFixed(2)}`

const isCrew = (worker: WorkerRow) => worker.role !== 'captain'

const liveCrewOf = (view: RunView) => view.workers.filter(worker => worker.isLive && isCrew(worker))

const mspsAt = (view: RunView, stage: StageInfo) => view.msps.filter(msp => msp.stage === stage.id).length

export const stageSummary = (view: RunView) => {
  const counts = STAGE_TABLE.filter(stage => mspsAt(view, stage) > 0).map(stage => `${mspsAt(view, stage)} at ${stage.name}`)
  return counts.length === 0 ? `Stage ${stageName(view)}` : `Stage ${stageName(view)} · ${counts.join(', ')}`
}

const currentIndexOf = (view: RunView) => (view.isFinished ? STAGE_TABLE.length : stageIndex(view.stage))

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

type RailMark = 'done' | 'now' | 'to come'

const railMarkOf = (view: RunView, i: number): RailMark => {
  const current = currentIndexOf(view)
  return current === -1 || i > current ? 'to come' : i < current ? 'done' : 'now'
}

function railMarkSvg(stage: StageInfo, mark: RailMark): string {
  const c = RAIL_MARK / 2
  const body =
    mark === 'done'
      ? `<circle cx="${c}" cy="${c}" r="7" fill="${DONE}"/><path d="M${c - 3.2} ${c}l2.2 2.2 4.2-4.6" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`
      : mark === 'now'
        ? `<circle class="sv-live" cx="${c}" cy="${c}" r="10" fill="${stage.color}" opacity=".25"/><circle cx="${c}" cy="${c}" r="6" fill="${stage.color}"/>`
        : `<circle cx="${c}" cy="${c}" r="5" class="sv-k sv-mstroke" stroke-width="1.2"/>`
  return svg(RAIL_MARK, RAIL_MARK, body)
}

const stripSvg = (H: number, color: string, y = 0, h = H) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${STRIP_W}" height="${H}" viewBox="0 0 ${STRIP_W} ${H}" preserveAspectRatio="none"><rect y="${y}" width="${STRIP_W}" height="${h}" fill="${color}"/></svg>`

const linkSvg = (color: string) => stripSvg(RAIL_MARK, color, RAIL_MARK / 2 - LINK_H / 2, LINK_H)

function avatarSvg(msp: MspRow, i: number, isSelected: boolean): string {
  const { mark } = MSP_STATUS[msp.status]
  const isWorking = currentActivity(msp)?.isRunning ?? false
  return svg(
    AVATAR_W,
    AVATAR_H,
    `${isSelected ? `<rect data-selected="true" x="6" y="0" width="${AVATAR_W - 6}" height="${AVATAR_H}" rx="7" fill="none" stroke="${laneColorOf(i)}" stroke-width="2"/>` : ''}<rect x="0" y="0" width="3" height="${AVATAR_H}" rx="1.5" fill="${laneColorOf(i)}"/>
${crab(8, 1, 'builder', laneColorOf(i), mark === 'pending', isWorking, 1.1)}`,
  )
}

function markSvg(msp: MspRow, i: number): string {
  const half = MARK_PX / 2
  return svg(MARK_PX, MARK_PX, statusMark(half, half, MSP_STATUS[msp.status].mark, laneColorOf(i)))
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

function verdictSvg(layout: VerdictLayout, round: RoundRow): string {
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

const hotkeyOf = (i: number) => (i < MAX_HOTKEYS ? { hotkey: String(i + 1) } : {})

function desktopMspButton($: EngineInterface, ui: PaneElements, msp: MspRow, i: number, now: number, isSelected: boolean) {
  const { Button, Text } = ui
  const parts = [
    <Text weight="semibold" wrap="truncate-end" {...(isSelected ? { color: ACCENT } : {})}>
      {msp.label}
    </Text>,
    ' ',
    <Text dimColor={!isSelected} size="footnote" wrap="truncate-end">
      {activityText(msp, now)}
    </Text>,
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

function workingHeading(ui: PaneElements, selected: string | null, count: number) {
  const { Box, Text } = ui
  if (selected === null) {
    return (
      <Box key="working-heading" flexDirection="row" gap="sm">
        <Text dimColor>{workingTitle(selected)}</Text>
        <Text dimColor>{`· ${count}`}</Text>
      </Box>
    )
  }
  return (
    <Box key="working-heading" flexShrink={1} minWidth={0}>
      <Text weight="semibold" wrap="truncate-end">
        {workingTitle(selected)}
      </Text>
    </Box>
  )
}

const roundHeading = (worker: WorkerRow) => (worker.round === null ? 'Build' : `Round ${worker.round}`)

type Room = { columns: number; now: number }

type DesktopElements = PaneElements & Pick<Elements['desktop'], 'Svg'>

function rail(ui: DesktopElements, view: RunView, isEveryName: boolean): RenderElement {
  const { Box, Text, Svg } = ui
  const current = currentIndexOf(view)
  const parts = STAGE_TABLE.flatMap((stage, i) => {
    const mark = railMarkOf(view, i)
    const isNow = mark === 'now'
    const name = isEveryName || isNow ? (
      <Text size="caption" wrap="truncate-end" {...(isNow ? { color: stage.color, weight: 'semibold' as const } : { dimColor: true })}>
        {stage.name}
      </Text>
    ) : null
    const links = STAGE_TABLE.slice(i + 1, i + 2).map(next => (
      <Box key={`rail-link-${i}`} flexGrow={1} minWidth={0} overflow="hidden">
        <Svg source={linkSvg(i < current ? DONE : TRACK)} alt={`${stage.name} to ${next.name}`} width={STRIP_W} height={RAIL_MARK} />
      </Box>
    ))
    return [
      <Box key={`rail-stage-${i}`} flexDirection="column" alignItems="center" flexShrink={0}>
        <Svg source={railMarkSvg(stage, mark)} alt={`${stage.name}: ${mark}`} width={RAIL_MARK} height={RAIL_MARK} />
        {name}
      </Box>,
      ...links,
    ]
  })
  return (
    <Box key="pane-rail" flexDirection="row" alignItems="flex-start">
      {parts}
    </Box>
  )
}

function lanesBar(ui: DesktopElements, msp: MspRow, i: number): RenderElement {
  const { Box, Svg } = ui
  const share = lanesDoneShare(msp)
  const fill = MSP_STATUS[msp.status].mark === 'failed' ? FAIL : laneColorOf(i)
  return (
    <Box key={`msp-bar-${msp.label}`} flexDirection="row" flexGrow={1} minWidth={0}>
      <Box key={`msp-bar-done-${msp.label}`} width={0} flexGrow={share} overflow="hidden" backgroundColor={fill}>
        <Svg source={stripSvg(LANE_BAR_H, fill)} alt={`${msp.label}: ${lanesWords(msp)}`} width={STRIP_W} height={LANE_BAR_H} />
      </Box>
      {share < 1 ? (
        <Box key={`msp-bar-rest-${msp.label}`} width={0} flexGrow={1 - share} overflow="hidden" backgroundColor={TRACK}>
          <Svg source={stripSvg(LANE_BAR_H, TRACK)} alt={`${msp.label}: lanes still to build`} width={STRIP_W} height={LANE_BAR_H} />
        </Box>
      ) : null}
    </Box>
  )
}

function desktopPane($: EngineInterface, ui: DesktopElements, view: RunView, selected: string | null, room: Room) {
  const { Box, Text, Svg } = ui
  const { columns, now } = room
  const time = elapsed(view.startedAt, now)
  const lane = laneWordOf(view)
  const live = liveCrewOf(view)
  const crewRole = ROLE_LOOK[live[0]?.role ?? 'captain']
  const tile = (key: string, name: string, value: RenderElement) => (
    <Box key={key} flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0} borderStyle="round" borderDimColor paddingX={1}>
      <Text dimColor size="caption">
        {name}
      </Text>
      {value}
    </Box>
  )
  const mspCards = view.msps.flatMap((msp, i): Card[] => [
    { scope: `pane-msp-${i}`, lines: [mspLabel(msp, now), msp.branch, mspStatusText(msp), lanesWords(msp)] },
    ...(msp.proof === null ? [] : [{ scope: `pane-proof-${i}`, lines: [...PROOF_HINT, proofVerdict(msp)] }]),
  ])
  const mspRow = (msp: MspRow, i: number) => (
    <Box key={`msp-row-${msp.label}`} flexDirection="row" alignItems="center" gap="sm">
      {cardTrigger(
        ui,
        `pane-msp-${i}`,
        <Svg key={`msp-avatar-${msp.label}`} source={avatarSvg(msp, i, msp.label === selected)} alt={`${msp.label} crab`} width={AVATAR_W} height={AVATAR_H} />,
      )}
      <Box key={`msp-main-${msp.label}`} flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>
        <Box key={`msp-line-${msp.label}`} flexDirection="row" alignItems="center" gap="sm">
          <Box key={`msp-press-${msp.label}`} flexGrow={1} flexShrink={1} minWidth={0}>
            {desktopMspButton($, ui, msp, i, now, msp.label === selected)}
          </Box>
          <Svg key={`msp-mark-${msp.label}`} source={markSvg(msp, i)} alt={`${msp.label}: ${MSP_STATUS[msp.status].word}`} width={MARK_PX} height={MARK_PX} />
        </Box>
        <Box key={`msp-lanes-${msp.label}`} flexDirection="row" alignItems="center" gap="sm">
          {lanesBar(ui, msp, i)}
          {msp.proof === null
            ? null
            : cardTrigger(
                ui,
                `pane-proof-${i}`,
                <Svg key={`msp-proof-${msp.label}`} source={proofSvg(msp)} alt={proofWords(msp)} width={PROOF_W} height={PROOF_H} />,
              )}
        </Box>
      </Box>
    </Box>
  )
  const listed = listedWorkers(view, selected)
  const rightColumns = Math.max(
    0,
    ...listed.map(worker => columnsOf(rightText(worker, now))),
    ...listed.map(worker => (worker.contextShare === null ? 0 : CONTEXT_W / CELL_PX)),
  )
  const workerCards = listed.flatMap((worker, i): Card[] => {
    const round = isVerdictRow(view, worker) ? roundOf(view, worker) : undefined
    return [
      { scope: `pane-words-${i}`, lines: [round === undefined ? worker.words : verdictWords(worker)] },
      ...(round === undefined
        ? []
        : [{ scope: `pane-verdict-${i}`, lines: [worker.words, ...(roundActivityOf(view, worker)?.summary ?? []), VERDICT_LEGEND] }]),
      ...(worker.contextShare === null
        ? []
        : [{ scope: `pane-context-${i}`, lines: [contextHint(worker), ...(worker.model === null ? [] : [modelName(worker.model)])] }]),
    ]
  })
  const workerRow = (worker: WorkerRow, i: number) => {
    const key = workerKey(worker, i)
    const role = ROLE_LOOK[worker.role]
    const round = isVerdictRow(view, worker) ? roundOf(view, worker) : undefined
    const kind = round === undefined ? undefined : firstKindOf(view, worker)
    const words = round === undefined ? worker.words : verdictWords(worker)
    const right = rightText(worker, now)
    const layout = round === undefined ? undefined : verdictLayout(VERDICT_ROOM, round)
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
          {cardTrigger(
            ui,
            `pane-words-${i}`,
            <Text dimColor size="footnote" wrap="truncate-end">
              {words}
            </Text>,
            'shrink',
          )}
          {round === undefined || layout === undefined
            ? null
            : cardTrigger(
                ui,
                `pane-verdict-${i}`,
                <Svg key={`${key}-verdict`} source={verdictSvg(layout, round)} alt={worker.words} width={layout.W} height={layout.H} />,
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
          {worker.contextShare === null
            ? null
            : cardTrigger(ui, `pane-context-${i}`, <Svg source={contextSvg(worker)} alt={contextHint(worker)} width={CONTEXT_W} height={CONTEXT_H} />)}
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
  const cards: readonly Card[] = [{ scope: 'pane-slug', lines: [view.slug] }, ...mspCards, ...workerCards]
  return (
    <Box flexDirection="column" gap="md">
      <Box key="pane-title" flexDirection="column">
        <Text weight="bold" size="heading">
          {TITLE}
        </Text>
        <Box key="pane-thread" flexDirection="row" alignItems="center" gap="sm">
          {cardTrigger(
            ui,
            'pane-slug',
            <Text dimColor wrap="truncate-end">
              {view.slug}
            </Text>,
            'shrink',
          )}
          {lane === null ? null : <Svg key="pane-lane" source={chipSvg(lane)} alt={lane} width={chipWidthOf(lane)} height={CHIP_H} />}
        </Box>
      </Box>
      <Box key="pane-tiles" flexDirection="row" gap="sm">
        {tile('tile-cost', 'Cost', <Text weight="semibold" tabular wrap="truncate-end">{costText(view)}</Text>)}
        {tile(
          'tile-agents',
          'Agents',
          <Box flexDirection="row" alignItems="center" gap="xs">
            <Svg source={crabSvg(CREW_CRAB_PX, crewRole, true, false)} alt={`${costumeOf(crewRole)} crab`} width={CREW_CRAB_PX} height={CREW_CRAB_PX} />
            <Text weight="semibold" tabular>
              {String(live.length)}
            </Text>
          </Box>,
        )}
        {tile('tile-time', 'Time', <Text weight="semibold" tabular wrap="truncate-end">{time}</Text>)}
      </Box>
      {rail(ui, view, columns >= RAIL_NAMES_COLUMNS)}
      <Box key="pane-msps" flexDirection="column" gap="xs">
        <Text dimColor>{`MSPs · ${view.msps.length}`}</Text>
        {view.msps.map(mspRow)}
        {unplannedPulls(view).map(pull => (
          <Box key={`pull-row-${pull.number}`} flexDirection="row" alignItems="center" gap="sm">
            <Text weight="semibold">{`Pull request #${pull.number}`}</Text>
            <Text dimColor wrap="truncate-end">
              {pull.head}
            </Text>
          </Box>
        ))}
      </Box>
      <Box key="pane-workers" flexDirection="column" gap="xs">
        {workingHeading(ui, selected, listed.length)}
        {isMainThreadOnly && selectedMsp !== undefined ? (
          <Text key="main-thread-note" dimColor size="footnote">{`${activityText(selectedMsp, now)} · ${MAIN_THREAD}`}</Text>
        ) : null}
        {workerRows}
      </Box>
      {cardSlot(ui, 'pane-cards', cards, { top: 0, left: 0 })}
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
      {unplannedPulls(view).map(pull => (
        <Text key={`pull-row-${pull.number}`}>{`Pull request #${pull.number}  ${pull.head}`}</Text>
      ))}
      {workingHeading(ui, selected, listed.length)}
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
