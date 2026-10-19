import type { On, UiPane } from 'claude-code'
import { mock } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

export const HOME = '/home/owner'
export const SESSION_ID = 'sess-fixture'

export type FixtureFile = { text: string; mtimeMs: number }
export type Fixture = { files: Readonly<Record<string, FixtureFile>> }

export type FixtureEntry = { name: string; kind: 'file' | 'dir'; size: number; mtimeMs: number; isLink: false }
export type Recorded = { op: 'fs.write' | 'process.run' | 'process.spawn' | 'store.set'; detail: unknown }
export type Spawned = { agentId: string; model: string }

const missing = (path: string) => new Error(`ENOENT: no such file or directory, '${path}'`)

const withSlash = (path: string) => (path.endsWith('/') ? path : `${path}/`)

const pathsUnder = (fixture: Fixture | null, dir: string): string[] =>
  Object.keys(fixture?.files ?? {}).filter(path => path.startsWith(withSlash(dir)))

const newestUnder = (fixture: Fixture | null, dir: string): number =>
  Math.max(0, ...pathsUnder(fixture, dir).map(path => fixture?.files[path]?.mtimeMs ?? 0))

export function entriesOf(fixture: Fixture | null, dir: string): FixtureEntry[] {
  const prefix = withSlash(dir)
  const names = [...new Set(pathsUnder(fixture, dir).map(path => path.slice(prefix.length).split('/')[0] ?? ''))]
  return names
    .filter(name => name !== '')
    .map(name => {
      const file = fixture?.files[prefix + name]
      return file
        ? { name, kind: 'file' as const, size: file.text.length, mtimeMs: file.mtimeMs, isLink: false as const }
        : { name, kind: 'dir' as const, size: 0, mtimeMs: newestUnder(fixture, prefix + name), isLink: false as const }
    })
}

export type HarnessOptions = { now?: number }

export function harness(on: On, initial: Fixture | null, options: HarnessOptions = {}) {
  let world: {
    fixture: Fixture | null
    failing: Readonly<Record<string, string>>
    cwd: string
    reads: readonly string[]
    opened: readonly string[]
    closed: readonly string[]
    panes: readonly UiPane[]
    toasts: readonly string[]
    writes: readonly Recorded[]
    bash: readonly { match: string; exitCode: number }[]
    tools: Readonly<Record<string, unknown>>
    spawns: readonly Spawned[]
  } = {
    fixture: initial,
    failing: {},
    cwd: '/home/owner/work/api',
    reads: [],
    opened: [],
    closed: [],
    panes: [],
    toasts: [],
    writes: [],
    bash: [],
    tools: {},
    spawns: [],
  }
  const change = (next: Partial<typeof world>) => {
    world = { ...world, ...next }
  }
  const record = (entry: Recorded) => change({ writes: [...world.writes, entry] })

  const clock = mock.clock(on, { now: options.now ?? 0 })
  mock.env(on, { HOME })
  on('session.id', () => ({ value: SESSION_ID }))
  on('session.start', () => ({ cwd: world.cwd }) as never)
  on('command.register', () => ({ value: undefined }) as never)

  on('fs.read', (_$, e) => {
    change({ reads: [...world.reads, e.path] })
    const failure = world.failing[e.path]
    if (failure !== undefined) throw new Error(failure)
    const file = world.fixture?.files[e.path]
    if (file === undefined) throw missing(e.path)
    return { value: file.text }
  })
  on('fs.list', (_$, e) => {
    const path = e.path
    if (pathsUnder(world.fixture, path).length === 0) throw missing(path)
    return { value: entriesOf(world.fixture, path) }
  })
  on('fs.stat', (_$, e) => {
    const file = world.fixture?.files[e.path]
    if (file) return { value: { kind: 'file', size: file.text.length, mtimeMs: file.mtimeMs, isLink: false } }
    if (pathsUnder(world.fixture, e.path).length > 0) {
      return { value: { kind: 'dir', size: 0, mtimeMs: newestUnder(world.fixture, e.path), isLink: false } }
    }
    throw missing(e.path)
  })
  on('fs.exists', (_$, e) => ({
    value: world.fixture?.files[e.path] !== undefined || pathsUnder(world.fixture, e.path).length > 0,
  }))

  on('ui.open', (_$, e) => {
    const pane: UiPane = { id: e.id, title: e.title ?? '', isShown: true, isFocused: false, isPlaced: true }
    change({ opened: [...world.opened, e.id], panes: [...world.panes.filter(one => one.id !== e.id), pane] })
    return { value: { isPlaced: true } }
  })
  on('ui.close', (_$, e) => {
    change({ closed: [...world.closed, e.id], panes: world.panes.filter(one => one.id !== e.id) })
    return { value: undefined }
  })
  on('ui.panes', () => ({ value: world.panes }))
  on('ui.toast', (_$, e) => {
    change({ toasts: [...world.toasts, e.text] })
    return { value: undefined }
  })

  on('fs.write', (_$, e) => {
    record({ op: 'fs.write', detail: e.path })
    return { value: undefined }
  })
  on('process.run', (_$, e) => {
    record({ op: 'process.run', detail: e.argv })
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('process.spawn', async function* (_$, e) {
    record({ op: 'process.spawn', detail: e })
    return { value: { code: 0, signal: null } }
  })
  on('store.set', (_$, e) => {
    record({ op: 'store.set', detail: e.key })
    return { value: undefined }
  })

  on('tool.call', (_$, e) => {
    const tool = String(e.tool)
    if (tool in world.tools) return { result: world.tools[tool] } as never
    if (tool === 'Skill') return { result: 'ok' } as never
    if (tool === 'Bash') {
      const command = String((e as { command?: unknown }).command ?? '')
      const answer = world.bash.find(one => command.includes(one.match))
      return { result: { stdout: '', stderr: '', exitCode: answer?.exitCode ?? 0 } } as never
    }
    return { result: '' } as never
  })

  on('agent.spawn', () => {
    const [first, ...rest] = world.spawns
    change({ spawns: rest })
    return (first ?? { agentId: 'agent-unqueued', model: 'claude-opus-5-5' }) as never
  })

  return {
    clock,
    use: (fixture: Fixture | null) => change({ fixture }),
    failRead: (path: string, message: string) => change({ failing: { ...world.failing, [path]: message } }),
    reads: () => world.reads,
    opened: () => world.opened,
    closed: () => world.closed,
    toasts: () => world.toasts,
    writes: () => world.writes,
    answerBash: (match: string, exitCode: number) => change({ bash: [...world.bash, { match, exitCode }] }),
    answerTool: (tool: string, result: unknown) => change({ tools: { ...world.tools, [tool]: result } }),
    queueSpawn: (spawned: Spawned) => change({ spawns: [...world.spawns, spawned] }),
    start: async ($: Engine, cwd = '/home/owner/work/api') => {
      change({ cwd })
      return $.session.start({ source: 'startup', cwd, surface: 'terminal', isInteractive: true } as never)
    },
  }
}
