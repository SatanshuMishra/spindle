import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { FileFacts } from '../../types'
import { cacheOf, fetchChanged, isGone, readRunFiles } from './home'
import type { FileCache } from './home'
import { inferFacts } from './infer'
import { locate, sessionFile } from './session'
import type { SessionFile } from './session'
import { refresh } from './view'

const filesState = atom({ plugin: 'spindle', key: 'files' } as const, null)
const viewState = atom({ plugin: 'spindle', key: 'view' } as const, null)

export const POLL_MS = 2000

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

async function readFacts($: EngineInterface, cache: FileCache): Promise<{ facts: FileFacts | null; cache: FileCache }> {
  const where = await sessionFile($)
  if (where === null) return { facts: null, cache: {} }
  const known = await read($, filesState)
  const session = await readSession($, where, known?.home != null, cache)
  const location = locate(session.text, where.mitosis)
  if (location === null) return { facts: null, cache: session.cache }
  if (location.home !== null && (await isGone($, location.home))) return { facts: null, cache: session.cache }
  const run = await readRunFiles($, location, cache)
  return { facts: inferFacts(run.files), cache: { ...session.cache, ...run.cache } }
}

export async function startPolling($: EngineInterface): Promise<void> {
  let polling: { cache: FileCache; isBusy: boolean } = { cache: {}, isBusy: false }
  const pass = async () => {
    if (polling.isBusy) return
    const shown = await read($, viewState)
    if (shown?.isFinished === true) return
    polling = { ...polling, isBusy: true }
    try {
      const { facts, cache } = await readFacts($, polling.cache)
      polling = { ...polling, cache }
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
