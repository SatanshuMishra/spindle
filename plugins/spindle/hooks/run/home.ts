import type { EngineInterface, FsEntry } from 'claude-code'

import type { RunLocation } from './session'

export type FileText = { kind: 'absent' } | { kind: 'unreadable' } | { kind: 'text'; text: string }

const ABSENT: FileText = { kind: 'absent' }
const UNREADABLE: FileText = { kind: 'unreadable' }

export type CachedText = { mtimeMs: number; text: FileText }
export type FileCache = Readonly<Record<string, CachedText>>

export type ReviewRound = {
  n: number
  names: readonly string[]
  times: Readonly<Record<string, number>>
  verdicts: Readonly<Record<string, FileText>>
  findings: Readonly<Record<string, FileText>>
}

export type RunFiles = {
  location: RunLocation
  homeEntries: readonly FsEntry[] | null
  rounds: readonly ReviewRound[]
  plan: FileText
  planMtimeMs: number | null
  state: FileText
  laneNames: readonly string[]
  ledger: FileText
  follows: FileText
  lighthouse: FileText
}

type Wanted = { path: string; mtimeMs: number }
type Fetched = Wanted & { text: FileText }

const ROUND_FOLDER = /^round-(\d+)$/
const LIGHTHOUSE_FOLDER = /^run-(\d+)$/
const VERDICT = /^(.+)\.verdict\.json$/
const FINDINGS = /^(.+)\.findings\.json$/

export async function listing($: EngineInterface, path: string): Promise<readonly FsEntry[] | null> {
  try {
    return await $.fs.list(path)
  } catch {
    return null
  }
}

export async function isGone($: EngineInterface, path: string): Promise<boolean> {
  try {
    return !(await $.fs.exists(path))
  } catch {
    return false
  }
}

async function readText($: EngineInterface, path: string): Promise<FileText> {
  try {
    const text = await $.fs.read(path)
    return typeof text === 'string' ? { kind: 'text', text } : UNREADABLE
  } catch {
    return UNREADABLE
  }
}

export async function fetchChanged($: EngineInterface, wanted: readonly Wanted[], cache: FileCache): Promise<readonly Fetched[]> {
  return Promise.all(
    wanted.map(async ({ path, mtimeMs }) => {
      const known = cache[path]
      if (known !== undefined && known.mtimeMs === mtimeMs && known.text.kind !== 'unreadable') return { path, mtimeMs, text: known.text }
      return { path, mtimeMs, text: await readText($, path) }
    }),
  )
}

export const cacheOf = (fetched: readonly Fetched[]): FileCache =>
  Object.fromEntries(
    fetched.filter(({ text }) => text.kind !== 'unreadable').map(({ path, mtimeMs, text }) => [path, { mtimeMs, text }]),
  )

const fileIn = (entries: readonly FsEntry[] | null, folder: string, name: string): Wanted | null => {
  const entry = entries?.find(one => one.name === name && one.kind === 'file')
  return entry ? { path: `${folder}/${name}`, mtimeMs: entry.mtimeMs } : null
}

const folderNumbers = (entries: readonly FsEntry[] | null, pattern: RegExp): number[] =>
  (entries ?? [])
    .filter(entry => entry.kind === 'dir')
    .map(entry => pattern.exec(entry.name)?.[1])
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
      files: {
        location,
        homeEntries: null,
        rounds: [],
        plan: ABSENT,
        planMtimeMs: null,
        state: ABSENT,
        laneNames: [],
        ledger: ABSENT,
        follows: ABSENT,
        lighthouse: ABSENT,
      },
      cache: {},
    }
  }
  const [homeEntries, reviewEntries, runEntries, laneEntries, ledgerEntries, lighthouseEntries] = await Promise.all([
    listing($, home),
    listing($, `${home}/review`),
    listing($, runDir),
    listing($, `${runDir}/lanes`),
    listing($, parentOf(ledger)),
    listing($, `${home}/lighthouse`),
  ])
  const numbers = folderNumbers(reviewEntries, ROUND_FOLDER)
  const lighthouseRuns = folderNumbers(lighthouseEntries, LIGHTHOUSE_FOLDER)
  const latestLighthouse = lighthouseRuns[lighthouseRuns.length - 1]
  const lighthouseFolder = latestLighthouse === undefined ? null : `${home}/lighthouse/run-${latestLighthouse}`
  const [roundEntries, lighthouseRunEntries] = await Promise.all([
    Promise.all(numbers.map(n => listing($, `${home}/review/round-${n}`))),
    lighthouseFolder === null ? null : listing($, lighthouseFolder),
  ])
  const roundFiles = numbers.flatMap((n, i) =>
    (roundEntries[i] ?? [])
      .filter(entry => entry.kind === 'file' && (VERDICT.test(entry.name) || FINDINGS.test(entry.name)))
      .map(entry => ({ path: `${home}/review/round-${n}/${entry.name}`, mtimeMs: entry.mtimeMs })),
  )
  const planFile = fileIn(runEntries, runDir, 'plan.json')
  const stateFile = fileIn(runEntries, runDir, 'state.json')
  const ledgerFile = fileIn(ledgerEntries, parentOf(ledger), nameOf(ledger))
  const followsFile = fileIn(homeEntries, home, 'follows.json')
  const lighthouseFile = lighthouseFolder === null ? null : fileIn(lighthouseRunEntries, lighthouseFolder, 'verdict.json')
  const wanted = [planFile, stateFile, ledgerFile, followsFile, lighthouseFile, ...roundFiles].filter((one): one is Wanted => one !== null)
  const fetched = await fetchChanged($, wanted, cache)
  const textOf = (file: Wanted | null): FileText =>
    file === null ? ABSENT : (fetched.find(one => one.path === file.path)?.text ?? ABSENT)
  const rounds = numbers.map((n, i) => {
    const entries = (roundEntries[i] ?? []).filter(entry => entry.kind === 'file')
    const byLabel = (pattern: RegExp) =>
      Object.fromEntries(
        entries
          .filter(entry => pattern.test(entry.name))
          .map(entry => [pattern.exec(entry.name)?.[1] ?? '', textOf({ path: `${home}/review/round-${n}/${entry.name}`, mtimeMs: 0 })]),
      )
    return {
      n,
      names: entries.map(entry => entry.name),
      times: Object.fromEntries(entries.map(entry => [entry.name, entry.mtimeMs])),
      verdicts: byLabel(VERDICT),
      findings: byLabel(FINDINGS),
    }
  })
  return {
    files: {
      location,
      homeEntries,
      rounds,
      plan: textOf(planFile),
      planMtimeMs: planFile?.mtimeMs ?? null,
      state: textOf(stateFile),
      laneNames: (laneEntries ?? []).filter(entry => entry.kind === 'file').map(entry => entry.name),
      ledger: textOf(ledgerFile),
      follows: textOf(followsFile),
      lighthouse: textOf(lighthouseFile),
    },
    cache: cacheOf(fetched),
  }
}
