import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { EventFacts, FileFacts, RunIdentity } from '../../types'
import { eventLogOf, readEvents, recordOf } from './events'
import { cacheOf, fetchChanged, isGone, readRunFiles } from './home'
import type { FileCache } from './home'
import { eventRunFacts, inferFacts } from './infer'
import { locate, sessionFile } from './session'
import type { RunLocation, SessionFile } from './session'
import { NO_SIGNALS } from './state'
import { refresh } from './view'

const filesState = atom({ plugin: 'spindle', key: 'files' } as const, null)
const signalsState = atom({ plugin: 'spindle', key: 'signals' } as const, NO_SIGNALS)
const viewState = atom({ plugin: 'spindle', key: 'view' } as const, null)

export const POLL_MS = 2000

type Read = { facts: FileFacts | null; cache: FileCache; isOtherRun: boolean }

async function readSession($: EngineInterface, where: SessionFile, hasHome: boolean, cache: FileCache) {
  if (!hasHome) {
    try {
      const text = await $.fs.read(where.path)
      return { text: typeof text === 'string' ? text : null, cache: {} }
    } catch {
      return { text: null, cache: {} }
    }
  }
  try {
    const stat = await $.fs.stat(where.path)
    const fetched = await fetchChanged($, [{ path: where.path, mtimeMs: stat.mtimeMs }], cache)
    const file = fetched[0]?.text
    return { text: file?.kind === 'text' ? file.text : null, cache: cacheOf(fetched) }
  } catch {
    return { text: null, cache: {} }
  }
}

const isSameLocated = (known: RunIdentity, location: RunLocation) =>
  known.slug === location.slug && (known.home === null || known.home === location.home)

async function readGoneRun(
  $: EngineInterface,
  mitosis: string,
  location: RunLocation,
  events: EventFacts,
  cache: FileCache,
): Promise<{ facts: FileFacts | null; cache: FileCache }> {
  const record = recordOf(mitosis, location)
  if (record !== null && !(await isGone($, `${record}/home`))) {
    const run = await readRunFiles($, { ...location, home: `${record}/home`, runDir: `${record}/run` }, cache)
    return { facts: { ...inferFacts({ ...run.files, location }), source: 'record', events }, cache: run.cache }
  }
  if (events.isPresent) return { facts: { ...eventRunFacts(location, events), source: 'events', events }, cache: {} }
  return { facts: null, cache: {} }
}

async function readRun(
  $: EngineInterface,
  mitosis: string,
  location: RunLocation,
  events: EventFacts,
  cache: FileCache,
): Promise<{ facts: FileFacts | null; cache: FileCache }> {
  if (location.home !== null && (await isGone($, location.home))) return readGoneRun($, mitosis, location, events, cache)
  const run = await readRunFiles($, location, cache)
  return { facts: { ...inferFacts(run.files), source: 'home', events }, cache: run.cache }
}

async function readFacts($: EngineInterface, cache: FileCache, isFinished: boolean): Promise<Read> {
  const where = await sessionFile($)
  if (where === null) return { facts: null, cache: {}, isOtherRun: false }
  const known = await read($, filesState)
  const session = await readSession($, where, known?.home != null, cache)
  const location = locate(session.text, where.mitosis)
  if (location === null) return { facts: null, cache: session.cache, isOtherRun: false }
  const isOtherRun = known !== null && !isSameLocated(known, location)
  if (isFinished && known !== null && !isOtherRun) {
    if (known.events.end !== null) return { facts: known, cache: session.cache, isOtherRun }
    const finished = await readEvents($, eventLogOf(where.mitosis, location), cache)
    return { facts: { ...known, events: finished.events }, cache: { ...session.cache, ...finished.cache }, isOtherRun }
  }
  const logged = await readEvents($, eventLogOf(where.mitosis, location), cache)
  const run = await readRun($, where.mitosis, location, logged.events, cache)
  return { facts: run.facts, cache: { ...session.cache, ...logged.cache, ...run.cache }, isOtherRun }
}

async function startOtherRun($: EngineInterface, facts: FileFacts | null): Promise<void> {
  if (facts?.home == null) return
  const signals = await read($, signalsState)
  if (signals.finishedRun != null) return
  await update($, signalsState, () => NO_SIGNALS)
}

export async function startPolling($: EngineInterface): Promise<void> {
  let polling: { cache: FileCache; isBusy: boolean } = { cache: {}, isBusy: false }
  const pass = async () => {
    if (polling.isBusy) return
    polling = { ...polling, isBusy: true }
    try {
      const shown = await read($, viewState)
      const { facts, cache, isOtherRun } = await readFacts($, polling.cache, shown?.isFinished === true)
      polling = { ...polling, cache }
      if (isOtherRun) await startOtherRun($, facts)
      const previous = await read($, filesState)
      if (JSON.stringify(previous) !== JSON.stringify(facts)) await update($, filesState, () => facts)
      await refresh($)
    } finally {
      polling = { ...polling, isBusy: false }
    }
  }
  await pass()
  $.clock.every(POLL_MS, () => {
    void pass()
  })
}
