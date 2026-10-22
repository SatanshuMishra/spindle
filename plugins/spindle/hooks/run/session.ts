import type { EngineInterface } from 'claude-code'

import { isObject, parseJson } from './state'

export type RunLocation = {
  slug: string
  repo: string | null
  home: string | null
  runDir: string | null
  ledger: string | null
}

export type SessionFile = { mitosis: string; path: string }

export const ledgerOf = (mitosis: string, repo: string) => `${mitosis}/${repo}/findings.jsonl`

type RunHome = { path: string; anchor: unknown }

const isRunHome = (value: unknown): value is RunHome => isObject(value) && typeof value.path === 'string'

const segments = (path: string) => path.split('/').filter(part => part !== '')

export async function sessionFile($: EngineInterface): Promise<SessionFile | null> {
  const home = await $.env.get('HOME')
  if (home === undefined || home === '') return null
  const id = await $.session.id()
  const mitosis = `${home.replace(/\/+$/, '')}/.mitosis`
  return { mitosis, path: `${mitosis}/sessions/${id}.json` }
}

export function locate(text: string | null, mitosis: string): RunLocation | null {
  if (text === null) return null
  const session = parseJson(text)
  if (!isObject(session)) return null
  const thread = typeof session.thread_id === 'string' && session.thread_id !== '' ? session.thread_id : null
  const homes = Array.isArray(session.run_homes) ? session.run_homes.filter(isRunHome) : []
  const candidates =
    thread === null
      ? homes
      : homes.filter(entry => typeof entry.anchor === 'string' && entry.anchor.includes(`, thread ${thread}: `))
  const chosen = candidates.find(entry => entry.anchor === session.latest_anchor) ?? candidates[0]
  if (chosen === undefined) {
    return thread === null ? null : { slug: thread, repo: null, home: null, runDir: null, ledger: null }
  }
  const parts = segments(chosen.path)
  const slug = parts[parts.length - 1]
  const repo = parts[parts.length - 2]
  if (slug === undefined || repo === undefined) return null
  return {
    slug,
    repo,
    home: chosen.path.replace(/\/+$/, ''),
    runDir: `${mitosis}/runs/${repo}/${slug}`,
    ledger: ledgerOf(mitosis, repo),
  }
}
