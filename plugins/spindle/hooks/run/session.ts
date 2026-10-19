import type { EngineInterface } from 'claude-code'

export type RunLocation = {
  slug: string
  repo: string | null
  home: string | null
  runDir: string | null
  ledger: string | null
}

export type SessionFile = { mitosis: string; path: string }

type RunHome = { path: string; anchor: unknown }

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isRunHome = (value: unknown): value is RunHome => isObject(value) && typeof value.path === 'string'

const segments = (path: string) => path.split('/').filter(part => part !== '')

export async function sessionFile($: EngineInterface): Promise<SessionFile | null> {
  const home = await $.env.get('HOME')
  if (home === undefined || home === '') return null
  const id = await $.session.id()
  const mitosis = `${home.replace(/\/+$/, '')}/.mitosis`
  return { mitosis, path: `${mitosis}/sessions/${id}.json` }
}

function parse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

export function locate(text: string | null, mitosis: string): RunLocation | null {
  if (text === null) return null
  const session = parse(text)
  if (!isObject(session)) return null
  const homes = Array.isArray(session.run_homes) ? session.run_homes.filter(isRunHome) : []
  const anchored = homes.find(entry => entry.anchor === session.latest_anchor)
  const chosen = anchored ?? homes[homes.length - 1]
  if (chosen === undefined) {
    const thread = session.thread_id
    return typeof thread === 'string' && thread !== ''
      ? { slug: thread, repo: null, home: null, runDir: null, ledger: null }
      : null
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
    ledger: `${mitosis}/${repo}/findings.jsonl`,
  }
}
