import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { PastRun, PastRuns } from '../../types'
import { eventLogOf, readEvents } from './events'
import { listing } from './home'
import { buildView } from './infer'
import { readGoneRun } from './poll'
import { ledgerOf, sessionFile } from './session'
import type { RunLocation } from './session'
import { NO_SIGNALS } from './state'

export const MAX_PAST_RUNS = 10

const pastRunsState = atom({ plugin: 'spindle', key: 'pastRuns' } as const, null)
const pastViewState = atom({ plugin: 'spindle', key: 'pastView' } as const, null)
const pastSelectedState = atom({ plugin: 'spindle', key: 'pastSelectedMsp' } as const, null)

const recordsOf = (mitosis: string, repo: string) => `${mitosis}/${repo}/records`

async function listPastRuns($: EngineInterface, mitosis: string, repo: string, shownSlug: string | null): Promise<PastRuns | null> {
  const entries = await listing($, recordsOf(mitosis, repo))
  if (entries === null) return null
  const runs: readonly PastRun[] = entries
    .filter(entry => entry.kind === 'dir' && entry.name !== shownSlug)
    .map(entry => ({ slug: entry.name, mtimeMs: entry.mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, MAX_PAST_RUNS)
  return { repo, runs }
}

export async function storePastRuns($: EngineInterface, mitosis: string | null, location: RunLocation | null): Promise<void> {
  const repo = location?.repo ?? null
  const next = mitosis === null || repo === null ? null : await listPastRuns($, mitosis, repo, location?.slug ?? null)
  const previous = await read($, pastRunsState)
  if (JSON.stringify(previous) !== JSON.stringify(next)) await update($, pastRunsState, () => next)
}

const pastLocationOf = (mitosis: string, repo: string, slug: string): RunLocation => ({
  slug,
  repo,
  home: `${mitosis}/${repo}/${slug}`,
  runDir: `${mitosis}/runs/${repo}/${slug}`,
  ledger: ledgerOf(mitosis, repo),
})

export async function readPastRun($: EngineInterface, slug: string): Promise<void> {
  const [where, past] = await Promise.all([sessionFile($), read($, pastRunsState)])
  if (where === null || past === null) return
  const location = pastLocationOf(where.mitosis, past.repo, slug)
  const logged = await readEvents($, eventLogOf(where.mitosis, location), {})
  const run = await readGoneRun($, where.mitosis, location, logged.events, {})
  await update($, pastSelectedState, () => null)
  await update($, pastViewState, () => buildView(run.facts, NO_SIGNALS))
}

export async function leavePastRun($: EngineInterface): Promise<void> {
  await update($, pastSelectedState, () => null)
  await update($, pastViewState, () => null)
}
