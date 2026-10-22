import type { EngineInterface } from 'claude-code'

import type { EventFacts, Outcome, RunEnd, Stage, VerdictEvent } from '../../types'
import { cacheOf, fetchChanged } from './home'
import type { FileCache } from './home'
import type { RunLocation } from './session'
import { LANES, isObject, parseJson } from './state'
import type { Json } from './state'

export const NO_EVENTS: EventFacts = {
  isPresent: false,
  lane: null,
  follows: null,
  startedAt: null,
  stages: [],
  verdicts: [],
  isWorkAfterShip: false,
  isCleanDone: false,
  end: null,
}

const STAGE_EVENTS: readonly Stage[] = ['spec', 'build', 'ship', 'integrate', 'clean']
const OUTCOMES: readonly Outcome[] = ['green', 'loop', 'diagnose', 'blocked', 'hard-failure']

const textOr = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null)

const countOf = (value: unknown): number => (typeof value === 'number' ? value : Array.isArray(value) ? value.length : 0)

export const eventLogOf = (mitosis: string, location: RunLocation): string | null =>
  location.repo === null ? null : `${mitosis}/${location.repo}/events/${location.slug}.jsonl`

export const recordOf = (mitosis: string, location: RunLocation): string | null =>
  location.repo === null ? null : `${mitosis}/${location.repo}/records/${location.slug}`

const eventLines = (text: string): readonly Json[] =>
  text
    .split('\n')
    .map(line => parseJson(line))
    .filter(isObject)
    .filter(line => line.v === 1 && typeof line.ev === 'string')

const stageOf = (line: Json): Stage | null => STAGE_EVENTS.find(stage => stage === line.stage) ?? null

function verdictOf(line: Json): VerdictEvent | null {
  const msp = textOr(line.msp)
  if (msp === null || typeof line.round !== 'number') return null
  return {
    msp,
    round: line.round,
    outcome: OUTCOMES.find(outcome => outcome === line.outcome) ?? 'unknown',
    blockers: countOf(line.blockers),
    advisories: countOf(line.advisories),
  }
}

const endOf = (line: Json): RunEnd => ({ status: textOr(line.status), isDraft: line.draft === true })

const isWork = (line: Json) => line.ev === 'round.verdict' || (line.ev === 'stage.start' && line.stage === 'build')

export function eventFacts(text: string): EventFacts {
  const lines = eventLines(text)
  const start = lines.find(line => line.ev === 'run.start')
  const lastShip = lines.map(line => line.ev === 'stage.start' && line.stage === 'ship').lastIndexOf(true)
  const ended = lines.filter(line => line.ev === 'run.end')
  const last = ended[ended.length - 1]
  const startedAt = start === undefined || typeof start.ts !== 'string' ? NaN : Date.parse(start.ts)
  return {
    isPresent: true,
    lane: LANES.find(lane => lane === start?.lane) ?? null,
    follows: start === undefined ? null : textOr(start.follows),
    startedAt: Number.isNaN(startedAt) ? null : startedAt,
    stages: lines
      .filter(line => line.ev === 'stage.start')
      .map(stageOf)
      .filter((stage): stage is Stage => stage !== null),
    verdicts: lines
      .filter(line => line.ev === 'round.verdict')
      .map(verdictOf)
      .filter((verdict): verdict is VerdictEvent => verdict !== null),
    isWorkAfterShip: lastShip !== -1 && lines.slice(lastShip + 1).some(isWork),
    isCleanDone: lines.some(line => line.ev === 'clean.done'),
    end: last === undefined ? null : endOf(last),
  }
}

export async function readEvents(
  $: EngineInterface,
  path: string | null,
  cache: FileCache,
): Promise<{ events: EventFacts; cache: FileCache }> {
  if (path === null) return { events: NO_EVENTS, cache: {} }
  try {
    const stat = await $.fs.stat(path)
    const fetched = await fetchChanged($, [{ path, mtimeMs: stat.mtimeMs }], cache)
    const file = fetched[0]?.text
    return { events: file?.kind === 'text' ? eventFacts(file.text) : NO_EVENTS, cache: cacheOf(fetched) }
  } catch {
    return { events: NO_EVENTS, cache: {} }
  }
}
