import type { EngineInterface, FsEntry } from 'claude-code'

import type { RunLocation } from './session'

export type CachedText = { mtimeMs: number; text: string | null }
export type FileCache = Readonly<Record<string, CachedText>>

export type ReviewRound = {
  n: number
  names: readonly string[]
  verdicts: Readonly<Record<string, string | null>>
}

export type RunFiles = {
  location: RunLocation
  homeEntries: readonly FsEntry[] | null
  rounds: readonly ReviewRound[]
  plan: string | null
  state: string | null
  laneNames: readonly string[]
  ledger: string | null
}

type Wanted = { path: string; mtimeMs: number }
type Fetched = Wanted & { text: string | null }

const ROUND_FOLDER = /^round-(\d+)$/
const VERDICT = /^(.+)\.verdict\.json$/

export async function listing($: EngineInterface, path: string): Promise<readonly FsEntry[] | null> {
  try {
    return await $.fs.list(path)
  } catch {
    return null
  }
}

async function readText($: EngineInterface, path: string): Promise<string | null> {
  try {
    const text = await $.fs.read(path)
    return typeof text === 'string' ? text : null
  } catch {
    return null
  }
}

export async function fetchChanged($: EngineInterface, wanted: readonly Wanted[], cache: FileCache): Promise<readonly Fetched[]> {
  return Promise.all(
    wanted.map(async ({ path, mtimeMs }) => {
      const known = cache[path]
      if (known !== undefined && known.mtimeMs === mtimeMs) return { path, mtimeMs, text: known.text }
      return { path, mtimeMs, text: await readText($, path) }
    }),
  )
}

export const cacheOf = (fetched: readonly Fetched[]): FileCache =>
  Object.fromEntries(fetched.map(({ path, mtimeMs, text }) => [path, { mtimeMs, text }]))

const fileIn = (entries: readonly FsEntry[] | null, folder: string, name: string): Wanted | null => {
  const entry = entries?.find(one => one.name === name && one.kind === 'file')
  return entry ? { path: `${folder}/${name}`, mtimeMs: entry.mtimeMs } : null
}

const roundNumbers = (entries: readonly FsEntry[] | null): number[] =>
  (entries ?? [])
    .filter(entry => entry.kind === 'dir')
    .map(entry => ROUND_FOLDER.exec(entry.name)?.[1])
    .filter((digits): digits is string => digits !== undefined)
    .map(Number)
    .sort((a, b) => a - b)

const parentOf = (path: string) => path.slice(0, path.lastIndexOf('/'))
const nameOf = (path: string) => path.slice(path.lastIndexOf('/') + 1)

export async function readRunFiles(
  $: EngineInterface,
  location: RunLocation,
  cache: FileCache,
): Promise<{ files: RunFiles; cache: FileCache }> {
  const { home, runDir, ledger } = location
  if (home === null || runDir === null || ledger === null) {
    return {
      files: { location, homeEntries: null, rounds: [], plan: null, state: null, laneNames: [], ledger: null },
      cache: {},
    }
  }
  const [homeEntries, reviewEntries, runEntries, laneEntries, ledgerEntries] = await Promise.all([
    listing($, home),
    listing($, `${home}/review`),
    listing($, runDir),
    listing($, `${runDir}/lanes`),
    listing($, parentOf(ledger)),
  ])
  const numbers = roundNumbers(reviewEntries)
  const roundEntries = await Promise.all(numbers.map(n => listing($, `${home}/review/round-${n}`)))
  const verdictFiles = numbers.flatMap((n, i) =>
    (roundEntries[i] ?? [])
      .filter(entry => entry.kind === 'file' && VERDICT.test(entry.name))
      .map(entry => ({ path: `${home}/review/round-${n}/${entry.name}`, mtimeMs: entry.mtimeMs })),
  )
  const planFile = fileIn(runEntries, runDir, 'plan.json')
  const stateFile = fileIn(runEntries, runDir, 'state.json')
  const ledgerFile = fileIn(ledgerEntries, parentOf(ledger), nameOf(ledger))
  const wanted = [planFile, stateFile, ledgerFile, ...verdictFiles].filter((one): one is Wanted => one !== null)
  const fetched = await fetchChanged($, wanted, cache)
  const textOf = (file: Wanted | null) => (file === null ? null : (fetched.find(one => one.path === file.path)?.text ?? null))
  const rounds = numbers.map((n, i) => {
    const entries = (roundEntries[i] ?? []).filter(entry => entry.kind === 'file')
    const verdicts = Object.fromEntries(
      entries
        .map(entry => VERDICT.exec(entry.name)?.[1])
        .filter((label): label is string => label !== undefined)
        .map(label => [label, textOf({ path: `${home}/review/round-${n}/${label}.verdict.json`, mtimeMs: 0 })]),
    )
    return { n, names: entries.map(entry => entry.name), verdicts }
  })
  return {
    files: {
      location,
      homeEntries,
      rounds,
      plan: textOf(planFile),
      state: textOf(stateFile),
      laneNames: (laneEntries ?? []).filter(entry => entry.kind === 'file').map(entry => entry.name),
      ledger: textOf(ledgerFile),
    },
    cache: cacheOf(fetched),
  }
}
