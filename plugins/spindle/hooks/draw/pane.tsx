import { atom, read } from 'claude-code'
import type { EngineInterface, RenderInput } from 'claude-code'

import type { AgentRow, MspRow, MspStatus, Outcome, Role, RoundRow, RunView } from '../../types'
import { LANE_NAME } from '../run/state'
import { NO_RUN, elapsed, modelName } from '../run/summary'
import { ROLE_COLOR, colorOf, costumeOf, crab } from './crew'
import type { Costume } from './crew'
import {
  ACCENT,
  DONE,
  FAIL,
  FONT,
  LANE_COLORS,
  STAGE_TABLE,
  fitText,
  stageIndex,
  stageInfo,
  statusMark,
  svg,
  textWidth,
  xml,
} from './text'
import type { Mark } from './text'

export const PANE = 'spindle-run'
export const PANE_TITLE = 'Pipeline'

const viewState = atom({ plugin: 'spindle', key: 'view' } as const, null)

const HEADER_H = 72
const RAIL_H = 44
const MSP_H = 54
const AGENT_H = 44
const ROUND_H = 50
const CONTEXT_W = 48
const MONO = "ui-monospace,'SF Mono',Menlo,monospace"

const ROLE_NAME: Readonly<Record<Exclude<Role, 'plain'>, string>> = {
  captain: 'Captain',
  scribe: 'Scribe',
  builder: 'Builder',
  detective: 'Detective',
  judge: 'Judge',
  courier: 'Courier',
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

type Working = {
  key: string
  name: string
  task: string
  alt: string
  costume: Costume
  color: string
  meta: string
  context: number
}

const laneWordOf = (view: RunView) => (view.lane === null ? null : `${LANE_NAME[view.lane]} lane`)

const headerAlt = (view: RunView) => {
  const lane = laneWordOf(view)
  return lane === null ? view.slug : `${view.slug}, ${lane}`
}

const stageName = (view: RunView) => (view.isFinished ? 'Done' : (stageInfo(view.stage)?.name ?? '?'))

const costText = (view: RunView) => `≈$${view.costUsd.toFixed(2)} session`

const agentsText = (view: RunView) => `${view.agents.filter(agent => agent.isRunning).length} live · ${view.agents.length}`

const mspStatusText = (msp: MspRow) => {
  const word = MSP_STATUS[msp.status].word
  if (msp.pr !== '') return `${word} ${msp.pr}`
  return msp.round > 0 ? `${word} · R${msp.round}` : word
}

const proofMarks = (msp: MspRow) =>
  msp.proof === null ? '' : `proof ${msp.proof.isRedSeen ? '●' : '○'}${msp.proof.isGreenSeen ? '●' : '○'}`

const roleName = (agent: AgentRow) => (agent.role === 'plain' ? agent.type : ROLE_NAME[agent.role])

const contextOf = (agent: AgentRow) => (agent.contextMax > 0 ? Math.min(1, agent.contextTokens / agent.contextMax) : 0)

function agentWorking(agent: AgentRow, now: number): Working {
  const name = roleName(agent)
  const task = agent.role === 'plain' ? agent.description : agent.type
  return {
    key: `agent-${agent.id}`,
    name,
    task,
    alt: `${name}: ${task}`,
    costume: costumeOf(agent.role),
    color: colorOf(agent.role),
    meta: `${modelName(agent.model)} · ${elapsed(agent.startedAt, now)}`,
    context: contextOf(agent),
  }
}

const synthetic = (role: Role, name: string, task: string, alt: string, meta: string): Working => ({
  key: `role-${role}`,
  name,
  task,
  alt,
  costume: costumeOf(role),
  color: colorOf(role),
  meta,
  context: 0,
})

export function workingRows(view: RunView, now: number): readonly Working[] {
  const time = elapsed(view.startedAt, now)
  const rows = [
    ...view.agents.filter(agent => agent.isRunning).map(agent => agentWorking(agent, now)),
    ...(view.buildingLanes > 0
      ? [synthetic('builder', `Builder ×${view.buildingLanes}`, view.buildingTier, `Builder ×${view.buildingLanes}`, time)]
      : []),
    ...(view.isPullRequestRunning ? [synthetic('courier', 'Courier', 'pull request', 'Courier: pull request', time)] : []),
  ]
  return rows.length > 0 ? rows : [synthetic('captain', 'Captain', 'main thread', 'Captain: main thread', time)]
}

function headerSvg(W: number, view: RunView, time: string): string {
  const gap = 6
  const tileW = (W - gap * 2) / 3
  const tile = (i: number, key: string, value: string) => `<rect class="sv-tile" x="${i * (tileW + gap)}" y="28" width="${tileW}" height="40" rx="8"/>
<text class="sv-s" x="${i * (tileW + gap) + 9}" y="44" font-family="${FONT}" font-size="11">${xml(key)}</text>
<text class="sv-t" x="${i * (tileW + gap) + 9}" y="61" font-family="${FONT}" font-size="15" font-weight="600" style="font-variant-numeric:tabular-nums">${xml(fitText(value, 15, tileW - 18))}</text>`
  const lane = laneWordOf(view)
  const title = fitText(view.slug, 14, Math.max(60, W - 120))
  const titleW = textWidth(title, 14)
  const laneW = lane === null ? 0 : textWidth(lane, 10.5) + 14
  const chip =
    lane === null
      ? ''
      : `<rect class="sv-k" x="${titleW + 8}" y="3" width="${laneW}" height="16" rx="4"/>
<text class="sv-s" x="${titleW + 8 + laneW / 2}" y="14.8" text-anchor="middle" font-family="${FONT}" font-size="10.5" font-weight="600">${xml(lane)}</text>`
  return svg(
    W,
    HEADER_H,
    `<text class="sv-t" x="0" y="15" font-family="${FONT}" font-size="14" font-weight="600">${xml(title)}</text>
${chip}
${tile(0, 'Cost', costText(view))}${tile(1, 'Agents', agentsText(view))}${tile(2, 'Time', time)}`,
    headerAlt(view),
  )
}

function railSvg(W: number, view: RunView): string {
  const count = STAGE_TABLE.length
  const step = (W - 24) / (count - 1)
  const current = view.isFinished ? count : stageIndex(view.stage)
  const nodes = STAGE_TABLE.map((stage, i) => {
    const x = 12 + i * step
    const status: Mark = current === -1 ? 'pending' : i < current ? 'done' : i === current ? 'running' : 'pending'
    const mark =
      status === 'done'
        ? `<circle cx="${x}" cy="12" r="7" fill="${DONE}"/><path d="M${x - 3.2} 12l2.2 2.2 4.2-4.6" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`
        : status === 'running'
          ? `<circle class="sv-live" cx="${x}" cy="12" r="10" fill="${stage.color}" opacity=".25"/><circle cx="${x}" cy="12" r="6" fill="${stage.color}"/>`
          : `<circle cx="${x}" cy="12" r="5" class="sv-k sv-mstroke" stroke-width="1.2"/>`
    return `${mark}<text class="${status === 'pending' ? 'sv-m' : 'sv-t'}" x="${x}" y="36" text-anchor="middle" font-family="${FONT}" font-size="10.5"${status === 'running' ? ' font-weight="600"' : ''}>${xml(stage.name)}</text>`
  })
  const doneX = 12 + Math.max(0, Math.min(current, count - 1)) * step
  return svg(
    W,
    RAIL_H,
    `<rect class="sv-k" x="12" y="11" width="${W - 24}" height="2" rx="1"/><rect x="12" y="11" width="${Math.max(0, doneX - 12)}" height="2" rx="1" fill="${DONE}"/>${nodes.join('')}`,
    `Stage ${stageName(view)}`,
  )
}

function proofSvg(W: number, msp: MspRow): string {
  if (msp.proof === null) return ''
  const red = msp.proof.isRedSeen ? `<circle cx="0" cy="0" r="3.5" fill="${FAIL}"/>` : `<circle cx="0" cy="0" r="3.5" fill="none" class="sv-mstroke" stroke-width="1.2"/>`
  const green = msp.proof.isGreenSeen
    ? `<circle cx="18" cy="0" r="3.5" fill="${DONE}"/>`
    : `<circle cx="18" cy="0" r="3.5" fill="none" class="sv-mstroke" stroke-width="1.2"/>`
  return `<g transform="translate(${W - 56},40)">${red}<path d="M6 0h6" class="sv-mstroke" stroke-width="1.2"/>${green}</g>`
}

function mspSvg(W: number, msp: MspRow, i: number): string {
  const { word, mark } = MSP_STATUS[msp.status]
  const color = LANE_COLORS[i % LANE_COLORS.length] ?? ACCENT
  const barX = 44
  const barW = Math.max(20, W - barX - 64)
  const done = msp.lanesTotal > 0 ? Math.min(1, msp.lanesDone / msp.lanesTotal) : 0
  return svg(
    W,
    MSP_H,
    `<rect x="0" y="4" width="3" height="46" rx="1.5" fill="${color}"/>
${crab(8, 10, 'builder', color, mark === 'pending', msp.status === 'building', 1.1)}
<text class="sv-t" x="${barX}" y="18" font-family="${FONT}" font-size="13" font-weight="600">${xml(fitText(msp.label, 13, barW - 90))}</text>
<text class="sv-m" x="${barX}" y="32" font-family="${MONO}" font-size="10">${xml(fitText(msp.branch, 10, barW))}</text>
<rect class="sv-k" x="${barX}" y="39" width="${barW}" height="4" rx="2"/>
<rect x="${barX}" y="39" width="${Math.round(barW * done)}" height="4" rx="2" fill="${mark === 'failed' ? FAIL : color}"/>
${statusMark(W - 8, 16, mark, color)}
<text class="sv-s" x="${W - 20}" y="20" text-anchor="end" font-family="${FONT}" font-size="11">${xml(mspStatusText(msp))}</text>
${proofSvg(W, msp)}`,
    `${msp.label}: ${word}`,
  )
}

function agentSvg(W: number, row: Working): string {
  return svg(
    W,
    AGENT_H,
    `${crab(4, 6, row.costume, row.color, false, true, 1.1)}
<text class="sv-t" x="44" y="18" font-family="${FONT}" font-size="13" font-weight="600">${xml(fitText(row.name, 13, W - 200))}</text>
<text class="sv-m" x="44" y="34" font-family="${FONT}" font-size="11">${xml(fitText(row.task, 11, W - 44 - CONTEXT_W - 12))}</text>
<text class="sv-s" x="${W}" y="18" text-anchor="end" font-family="${FONT}" font-size="11" style="font-variant-numeric:tabular-nums">${xml(row.meta)}</text>
<rect class="sv-k" x="${W - CONTEXT_W}" y="28" width="${CONTEXT_W}" height="4" rx="2"/>
<rect x="${W - CONTEXT_W}" y="28" width="${Math.round(CONTEXT_W * row.context)}" height="4" rx="2" class="sv-mfill"/>`,
    row.alt,
  )
}

function roundSvg(W: number, round: RoundRow): string {
  const chipW = textWidth(round.outcome, 11) + 18
  const candidates = round.candidates ?? round.blockers + round.advisories
  const seg = (W - 120) / Math.max(1, candidates)
  const pips = Array.from({ length: candidates }, (_, i) => {
    const fill = i < round.blockers ? FAIL : i < round.blockers + round.advisories ? ROLE_COLOR.verdict : null
    return `<rect x="${40 + i * seg}" y="30" width="${Math.max(3, seg - 3)}" height="8" rx="2" ${fill === null ? 'class="sv-k"' : `fill="${fill}"`}/>`
  }).join('')
  const detail = `${round.msp} · ${round.candidates ?? '?'} candidates · ${round.blockers} blockers · ${round.advisories} advisory`
  return svg(
    W,
    ROUND_H,
    `<text class="sv-t" x="0" y="20" font-family="${FONT}" font-size="13" font-weight="600">R${round.n}</text>
<text class="sv-s" x="40" y="20" font-family="${FONT}" font-size="11">${xml(fitText(detail, 11, W - 40))}</text>
${pips}
<rect x="${W - chipW}" y="25" width="${chipW}" height="18" rx="9" fill="${VERDICT_COLOR[round.outcome]}"/>
<text x="${W - chipW / 2}" y="37.5" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="600" fill="#fff">${xml(round.outcome)}</text>`,
    `Round ${round.n} ${round.msp}: ${round.outcome}`,
  )
}

const headerLine = (view: RunView) => {
  const lane = laneWordOf(view)
  return lane === null ? view.slug : `${view.slug}  [${lane}]`
}

const mspLine = (msp: MspRow) =>
  [msp.label, MSP_STATUS[msp.status].word, `${msp.lanesDone}/${msp.lanesTotal}`, proofMarks(msp), msp.pr]
    .filter(part => part !== '')
    .join('  ')

const workingLine = (row: Working) => `${row.name}  ${row.task}  ${row.meta}  context ${Math.round(row.context * 100)}%`

const roundLine = (round: RoundRow) =>
  `R${round.n} ${round.msp} ${round.outcome} · ${round.blockers} blockers, ${round.advisories} advisories`

export async function togglePane($: EngineInterface): Promise<string> {
  const panes = await $.ui.panes()
  if (panes.some(pane => pane.id === PANE)) {
    await $.ui.close({ id: PANE })
    return 'Run pane closed.'
  }
  await $.ui.open({ id: PANE, title: PANE_TITLE })
  return 'Run pane opened.'
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
  const time = elapsed(view.startedAt, now)
  const working = workingRows(view, now)
  if (e.surface === 'desktop' && 'Svg' in ui) {
    const { Svg } = ui
    const W = Math.max(240, Math.min(900, (e.props.bodyColumns || 60) * 8 - 8))
    return (
      <Box flexDirection="column" gap={1}>
        <Svg key="header" source={headerSvg(W, view, time)} alt={headerAlt(view)} width={W} height={HEADER_H} />
        <Svg key="rail" source={railSvg(W, view)} alt={`Stage ${stageName(view)}`} width={W} height={RAIL_H} />
        <Text dimColor>{`MSPs · ${view.msps.length}`}</Text>
        {view.msps.map((msp, i) => (
          <Svg key={`msp-${msp.label}`} source={mspSvg(W, msp, i)} alt={`${msp.label}: ${MSP_STATUS[msp.status].word}`} width={W} height={MSP_H} />
        ))}
        <Text dimColor>{`Working now · ${working.length}`}</Text>
        {working.map(row => (
          <Svg key={row.key} source={agentSvg(W, row)} alt={row.alt} width={W} height={AGENT_H} />
        ))}
        <Text dimColor>{`Review rounds · ${view.rounds.length}`}</Text>
        {view.rounds.map(round => (
          <Svg
            key={`round-${round.n}-${round.msp}`}
            source={roundSvg(W, round)}
            alt={`Round ${round.n} ${round.msp}: ${round.outcome}`}
            width={W}
            height={ROUND_H}
          />
        ))}
      </Box>
    )
  }
  return (
    <Box flexDirection="column">
      <Text bold>{headerLine(view)}</Text>
      <Text>{`${costText(view)}  ·  Agents ${agentsText(view)}  ·  Time ${time}`}</Text>
      <Text>{`Stage ${stageName(view)}`}</Text>
      <Text dimColor>{`MSPs · ${view.msps.length}`}</Text>
      {view.msps.map(msp => (
        <Text key={`msp-${msp.label}`}>{mspLine(msp)}</Text>
      ))}
      <Text dimColor>{`Working now · ${working.length}`}</Text>
      {working.map(row => (
        <Text key={row.key}>{workingLine(row)}</Text>
      ))}
      <Text dimColor>{`Review rounds · ${view.rounds.length}`}</Text>
      {view.rounds.map(round => (
        <Text key={`round-${round.n}-${round.msp}`}>{roundLine(round)}</Text>
      ))}
    </Box>
  )
}
