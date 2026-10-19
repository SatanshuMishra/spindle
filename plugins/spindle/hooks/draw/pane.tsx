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
  DONE,
  FAIL,
  FONT,
  LANE_COLORS,
  STAGE_TABLE,
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
const COST_HINT = "Cost of this session's model calls"
const TIME_HINT = 'Time since the run started'
const PROOF_HINT = 'Acceptance test failed without the work (red) and passed with it (green)'
const VERDICT_LEGEND = 'Red: blocker · yellow: advisory · grey: other candidate'
const RAIL_H = 44
const RAIL_LABEL_PX = 10.5
const RAIL_NAMES_COLUMNS = 60
const MARK_W = 48
const MARK_H = 36
const MARK_COLUMNS = MARK_W / CELL_PX
const LANE_BAR_H = 6
const PROOF_W = 24
const PROOF_H = 10
const PROOF_COLUMNS = columnsOf('proof') + 1 + PROOF_W / CELL_PX
const CREW_CRAB_PX = 18
const WORKER_CRAB_PX = 32
const WORKER_CRAB_COLUMNS = WORKER_CRAB_PX / CELL_PX
const CONTEXT_W = 48
const CONTEXT_H = 4
const PIP = 8
const PIP_STEP = 10
const CHIP_H = 18
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

const railAlt = (view: RunView) => {
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
        ? `<text class="${status === 'pending' ? 'sv-m' : 'sv-t'}" x="${labelX}" y="36" text-anchor="middle" font-family="${FONT}" font-size="${RAIL_LABEL_PX}"${status === 'running' ? ' font-weight="600"' : ''}>${xml(stage.name)}</text>`
        : ''
    return `${mark}${label}`
  })
  const doneX = left + Math.max(0, Math.min(current, count - 1)) * step
  return svg(
    W,
    RAIL_H,
    `<rect class="sv-k" x="${left}" y="11" width="${right - left}" height="2" rx="1"/><rect x="${left}" y="11" width="${Math.max(0, doneX - left)}" height="2" rx="1" fill="${DONE}"/>${nodes.join('')}`,
  )
}

function mspMarkSvg(msp: MspRow, i: number): string {
  const { mark } = MSP_STATUS[msp.status]
  const isWorking = currentActivity(msp)?.isRunning ?? false
  return svg(
    MARK_W,
    MARK_H,
    `<rect x="0" y="2" width="3" height="${MARK_H - 4}" rx="1.5" fill="${laneColorOf(i)}"/>
${crab(6, 1, 'builder', laneColorOf(i), mark === 'pending', isWorking, 1.1)}
${statusMark(MARK_W - 6, 8, mark, laneColorOf(i))}`,
  )
}

function laneBarSvg(W: number, msp: MspRow, i: number): string {
  const fill = MSP_STATUS[msp.status].mark === 'failed' ? FAIL : laneColorOf(i)
  return svg(
    W,
    LANE_BAR_H,
    `<rect class="sv-k" x="0" y="1" width="${W}" height="4" rx="2"/>
<rect x="0" y="1" width="${Math.round(W * lanesDoneShare(msp))}" height="4" rx="2" fill="${fill}"/>`,
  )
}

function proofSvg(msp: MspRow): string {
  const red = msp.proof?.isRedSeen
    ? `<circle cx="4" cy="5" r="3.5" fill="${FAIL}"/>`
    : `<circle cx="4" cy="5" r="3.5" fill="none" class="sv-mstroke" stroke-width="1.2"/>`
  const green = msp.proof?.isGreenSeen
    ? `<circle cx="20" cy="5" r="3.5" fill="${DONE}"/>`
    : `<circle cx="20" cy="5" r="3.5" fill="none" class="sv-mstroke" stroke-width="1.2"/>`
  return svg(PROOF_W, PROOF_H, `${red}<path d="M9 5h6" class="sv-mstroke" stroke-width="1.2"/>${green}`)
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

const CHIP_PAD = 18
const CHIP_GAP = 6
const PIP_ROW_GAP = 4

type Spot = { x: number; y: number }

type VerdictLayout = { W: number; H: number; chip: Spot & { w: number; word: string }; pips: readonly Spot[] }

const pipsSpan = (count: number) => (count === 0 ? 0 : count * PIP_STEP - (PIP_STEP - PIP))

const pipsPerRow = (room: number) => Math.max(0, Math.floor((room + PIP_STEP - PIP) / PIP_STEP))

const pipGrid = (count: number, perRow: number, top: number): Spot[] =>
  Array.from({ length: count }, (_, i) => ({ x: (i % perRow) * PIP_STEP, y: top + Math.floor(i / perRow) * PIP_STEP }))

function verdictLayout(maxW: number, round: RoundRow): VerdictLayout {
  const chipW = Math.min(maxW, textWidth(round.outcome, 11) + CHIP_PAD)
  const word = fitText(round.outcome, 11, chipW - CHIP_PAD)
  const candidates = Math.max(round.candidates ?? 0, round.blockers + round.advisories)
  const beside = pipsPerRow(maxW - chipW - CHIP_GAP)
  if (candidates === 0) return { W: chipW, H: CHIP_H, chip: { x: 0, y: 0, w: chipW, word }, pips: [] }
  if (beside >= 1) {
    const rows = Math.ceil(candidates / beside)
    const top = rows === 1 ? (CHIP_H - PIP) / 2 : 0
    const pips = pipGrid(candidates, beside, top)
    const chipX = pipsSpan(Math.min(candidates, beside)) + CHIP_GAP
    return { W: chipX + chipW, H: Math.max(CHIP_H, pipsSpan(rows)), chip: { x: chipX, y: 0, w: chipW, word }, pips }
  }
  const below = Math.max(1, pipsPerRow(maxW))
  const rows = Math.ceil(candidates / below)
  const top = CHIP_H + PIP_ROW_GAP
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
    `${pips}<rect x="${chip.x}" y="${chip.y}" width="${chip.w}" height="${CHIP_H}" rx="9" fill="${VERDICT_COLOR[round.outcome]}"/>
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

function mspButton($: EngineInterface, ui: PaneElements, msp: MspRow, i: number, label: string) {
  const { Button } = ui
  return (
    <Button
      key={`msp-${msp.label}`}
      label={label}
      plain
      {...(i < MAX_HOTKEYS ? { hotkey: String(i + 1) } : {})}
      onPress={async () => {
        await toggleSelection($, msp.label)
      }}
    />
  )
}

function workingHeading(ui: PaneElements, selected: string | null, count: number) {
  const { Box, Text } = ui
  return (
    <Box key="working-heading" flexDirection="row" gap={1}>
      <Text dimColor>{workingTitle(selected)}</Text>
      {selected === null ? <Text dimColor>{`· ${count}`}</Text> : null}
    </Box>
  )
}

type Room = { columns: number; now: number }

type DesktopElements = PaneElements & Pick<Elements['desktop'], 'Svg'>

function verdictPicture(ui: DesktopElements, key: string, layout: VerdictLayout, round: RoundRow, worker: WorkerRow, summary: readonly string[]) {
  const { Svg } = ui
  return hint(
    ui,
    `${key}-verdict-hint`,
    <Svg key={`${key}-verdict`} source={verdictSvg(layout, round)} alt={worker.words} width={layout.W} height={layout.H} />,
    [...summary, VERDICT_LEGEND],
  )
}

function desktopPane($: EngineInterface, ui: DesktopElements, view: RunView, selected: string | null, room: Room) {
  const { Box, Text, Svg } = ui
  const { columns, now } = room
  const time = elapsed(view.startedAt, now)
  const lane = laneWordOf(view)
  const slugColumns = Math.max(4, columns - (lane === null ? 0 : columnsOf(lane) + 1))
  const slug = cut(view.slug, slugColumns)
  const railW = Math.max(CELL_PX, Math.min(900, columns * CELL_PX - CELL_PX))
  const live = liveCrewOf(view)
  const crewRole = ROLE_LOOK[live[0]?.role ?? 'captain']
  const tile = (key: string, name: string, value: RenderElement, lines: readonly string[]) =>
    hint(
      ui,
      key,
      <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1}>
        <Text dimColor size="caption">
          {name}
        </Text>
        {value}
      </Box>,
      lines,
    )
  const middleColumns = Math.max(2, columns - MARK_COLUMNS - 1 - PROOF_COLUMNS - 1)
  const mspRow = (msp: MspRow, i: number) => {
    const full = mspLabel(msp, now)
    const label = cut(full, middleColumns - 2)
    const lines = [...(label === full ? [] : [full]), msp.branch, mspStatusText(msp), `Lanes ${msp.lanesDone}/${msp.lanesTotal}`]
    return (
      <Box key={`msp-row-${msp.label}`} flexDirection="row" alignItems="center" gap={1}>
        {hint(
          ui,
          `msp-card-${msp.label}`,
          [
            <Svg key={`msp-mark-${msp.label}`} source={mspMarkSvg(msp, i)} alt={`${msp.label}: ${MSP_STATUS[msp.status].word}`} width={MARK_W} height={MARK_H} />,
            <Box key={`msp-main-${msp.label}`} flexDirection="column" flexGrow={1}>
              {mspButton($, ui, msp, i, label)}
              <Svg
                source={laneBarSvg(middleColumns * CELL_PX, msp, i)}
                alt={`${msp.label} lanes ${msp.lanesDone} of ${msp.lanesTotal}`}
                width={middleColumns * CELL_PX}
                height={LANE_BAR_H}
              />
            </Box>,
          ],
          lines,
        )}
        {msp.proof === null
          ? null
          : hint(
              ui,
              `msp-proof-${msp.label}`,
              [
                <Text key={`proof-word-${msp.label}`} dimColor size="caption">
                  proof
                </Text>,
                <Svg key={`proof-dots-${msp.label}`} source={proofSvg(msp)} alt={proofWords(msp)} width={PROOF_W} height={PROOF_H} />,
              ],
              [PROOF_HINT],
            )}
      </Box>
    )
  }
  const listed = listedWorkers(view, selected)
  const rightColumns = Math.max(
    0,
    ...listed.map(worker => [...rightText(worker, now)].length),
    ...listed.map(worker => (worker.contextShare === null ? 0 : CONTEXT_W / CELL_PX)),
  )
  const wordsColumns = Math.max(4, columns - WORKER_CRAB_COLUMNS - 1 - rightColumns - 1)
  const workerRow = (worker: WorkerRow, i: number) => {
    const key = workerKey(worker, i)
    const role = ROLE_LOOK[worker.role]
    const round = isVerdictRow(view, worker) ? roundOf(view, worker) : undefined
    const kind = round === undefined ? undefined : firstKindOf(view, worker)
    const words = round === undefined ? worker.words : verdictWords(worker)
    const shown = cut(words, wordsColumns)
    const right = rightText(worker, now)
    return (
      <Box key={key} flexDirection="row" gap={1}>
        <Svg
          key={`${key}-crab`}
          source={crabSvg(WORKER_CRAB_PX, role, worker.isLive, !worker.isLive)}
          alt={`${ROLE_NAME[worker.role]} crab`}
          width={WORKER_CRAB_PX}
          height={WORKER_CRAB_PX}
        />
        <Box key={`${key}-words`} flexDirection="column" flexGrow={1}>
          <Text weight="semibold">{ROLE_NAME[worker.role]}</Text>
          {shown === words ? <Text dimColor>{words}</Text> : hint(ui, `${key}-words-hint`, <Text dimColor>{shown}</Text>, [words])}
          {round === undefined
            ? null
            : verdictPicture(ui, key, verdictLayout(wordsColumns * CELL_PX, round), round, worker, roundActivityOf(view, worker)?.summary ?? [])}
          {kind === undefined ? null : <Text dimColor>{kind}</Text>}
        </Box>
        <Box key={`${key}-right`} flexDirection="column" alignItems="flex-start" width={rightColumns} flexShrink={0}>
          {right === '' ? null : <Text dimColor tabular>{right}</Text>}
          {worker.contextShare === null
            ? null
            : hint(
                ui,
                `${key}-context`,
                <Svg source={contextSvg(worker)} alt={contextHint(worker)} width={CONTEXT_W} height={CONTEXT_H} />,
                [contextHint(worker)],
              )}
        </Box>
      </Box>
    )
  }
  return (
    <Box flexDirection="column" gap={1}>
      <Box key="pane-title" flexDirection="column">
        <Text weight="semibold" size="heading">
          {TITLE}
        </Text>
        <Box key="pane-thread" flexDirection="row" gap={1}>
          {hint(ui, 'pane-slug-hint', <Text>{slug}</Text>, [view.slug])}
          {lane === null ? null : (
            <Text dimColor weight="semibold">
              {lane}
            </Text>
          )}
        </Box>
      </Box>
      <Box key="pane-tiles" flexDirection="row" gap={1} flexWrap="wrap">
        {tile('tile-cost', 'Cost', <Text weight="semibold" tabular>{costText(view)}</Text>, [COST_HINT])}
        {tile(
          'tile-agents',
          'Agents',
          <Box flexDirection="row" alignItems="center" gap={1}>
            <Svg source={crabSvg(CREW_CRAB_PX, crewRole, true, false)} alt={`${costumeOf(crewRole)} crab`} width={CREW_CRAB_PX} height={CREW_CRAB_PX} />
            <Text weight="semibold" tabular>
              {String(live.length)}
            </Text>
          </Box>,
          [agentsHint(view)],
        )}
        {tile('tile-time', 'Time', <Text weight="semibold" tabular>{time}</Text>, [TIME_HINT])}
      </Box>
      {hint(
        ui,
        'pane-rail-hint',
        <Svg key="pane-rail" source={railSvg(railW, view, columns >= RAIL_NAMES_COLUMNS)} alt={railAlt(view)} width={railW} height={RAIL_H} />,
        railLines(view),
      )}
      <Text dimColor>{`MSPs · ${view.msps.length}`}</Text>
      {view.msps.map(mspRow)}
      {workingHeading(ui, selected, listed.length)}
      {listed.map(workerRow)}
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
      <Text>{railAlt(view)}</Text>
      <Text dimColor>{`MSPs · ${view.msps.length}`}</Text>
      {view.msps.map((msp, i) => (
        <Box key={`msp-row-${msp.label}`} flexDirection="row" gap={1}>
          {mspButton($, ui, msp, i, mspLabel(msp, now))}
          <Text dimColor>{mspExtra(msp)}</Text>
        </Box>
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
