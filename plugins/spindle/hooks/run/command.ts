export type SimpleCommand = {
  readonly assignments: Readonly<Record<string, string>>
  readonly words: readonly string[]
}

const SEPARATORS = new Set([';', '&', '|', '\n', '(', ')'])
const BLANK = /\s/
const ASSIGNMENT = /^([A-Za-z_][A-Za-z0-9_]*)=([\s\S]*)$/
const SHELLS = new Set(['zsh', 'bash', 'sh'])

type Heredoc = { readonly delimiter: string; readonly stripsTabs: boolean }

function heredocDelimiter(text: string, from: number): { readonly heredoc: Heredoc; readonly end: number } {
  let index = from
  const stripsTabs = text[index] === '-'
  if (stripsTabs) index += 1
  while (text[index] === ' ' || text[index] === '\t') index += 1
  let delimiter = ''
  let quote: string | null = null
  for (; index < text.length; index += 1) {
    const char = text[index]!
    if (quote !== null) {
      if (char === quote) quote = null
      else delimiter += char
      continue
    }
    if (char === "'" || char === '"') quote = char
    else if (char === '\\' && index + 1 < text.length) delimiter += text[++index]!
    else if (BLANK.test(char) || SEPARATORS.has(char) || char === '<' || char === '>') break
    else delimiter += char
  }
  return { heredoc: { delimiter, stripsTabs }, end: index - 1 }
}

function skipHeredocBodies(text: string, newline: number, pending: readonly Heredoc[]): number {
  let lineStart = newline + 1
  for (const { delimiter, stripsTabs } of pending) {
    while (lineStart <= text.length) {
      const found = text.indexOf('\n', lineStart)
      const lineEnd = found === -1 ? text.length : found
      const line = text.slice(lineStart, lineEnd)
      lineStart = lineEnd + 1
      if ((stripsTabs ? line.replace(/^\t+/, '') : line) === delimiter) break
    }
  }
  return lineStart - 1
}

const CLOSERS: Readonly<Record<string, string>> = { '(': ')', '[': ']', '{': '}' }

function groupEnd(text: string, open: number): number {
  const opener = text[open]!
  const closer = CLOSERS[opener]!
  let depth = 0
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === opener) depth += 1
    else if (text[index] === closer) depth -= 1
    if (depth === 0) return index
  }
  return -1
}

type ShellGroup = { readonly words: string[]; readonly scope: number; isPiped: boolean }

type ShellScript = { readonly groups: readonly ShellGroup[]; readonly parents: readonly number[] }

function shellWords(text: string): ShellScript | null {
  const parents: number[] = [-1]
  let scope = 0
  let isPipedNext = false
  const groups: ShellGroup[] = [{ words: [], scope, isPiped: false }]
  let word: string | null = null
  let quote: '"' | "'" | "$'" | null = null
  let pending: Heredoc[] = []
  const finishWord = () => {
    if (word !== null) groups[groups.length - 1]!.words.push(word)
    word = null
  }
  const startGroup = () => {
    finishWord()
    groups.push({ words: [], scope, isPiped: isPipedNext })
    isPipedNext = false
  }
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!
    const following = text[index + 1]
    if (quote === "$'") {
      if (char === "'") quote = null
      else if (char === '\\' && following !== undefined) {
        word = (word ?? '') + following
        index += 1
      } else word = (word ?? '') + char
      continue
    }
    if (quote === "'") {
      if (char === "'") quote = null
      else word = (word ?? '') + char
      continue
    }
    if (quote === '"') {
      if (char === '"') quote = null
      else if (char === '\\' && following !== undefined) {
        word = (word ?? '') + following
        index += 1
      } else word = (word ?? '') + char
      continue
    }
    if (char === '\\' && following !== undefined) {
      word = (word ?? '') + following
      index += 1
      continue
    }
    if (char === '$' && following === "'") {
      quote = "$'"
      word = word ?? ''
      index += 1
      continue
    }
    if (char === '$' && (following === '[' || following === '{')) {
      const end = groupEnd(text, index + 1)
      if (end === -1) return null
      word = (word ?? '') + text.slice(index, end + 1)
      index = end
      continue
    }
    if (char === "'" || char === '"') {
      quote = char
      word = word ?? ''
      continue
    }
    if (char === '#' && word === null) {
      const found = text.indexOf('\n', index)
      index = (found === -1 ? text.length : found) - 1
      continue
    }
    if (char === '(' && following === '(') {
      const end = groupEnd(text, index)
      if (end === -1) return null
      word = (word ?? '') + text.slice(index, end + 1)
      index = end
      continue
    }
    if (text.startsWith('<<<', index)) {
      finishWord()
      index += 2
      continue
    }
    if (char === '<' && following === '<') {
      finishWord()
      const { heredoc, end } = heredocDelimiter(text, index + 2)
      pending = [...pending, heredoc]
      index = end
      continue
    }
    if (char === '\n' && pending.length > 0) {
      startGroup()
      index = skipHeredocBodies(text, index, pending)
      pending = []
      continue
    }
    if (char === '(') {
      parents.push(scope)
      scope = parents.length - 1
      startGroup()
      continue
    }
    if (char === ')') {
      scope = Math.max(parents[scope]!, 0)
      startGroup()
      continue
    }
    if (char === '|' && following !== '|' && text[index - 1] !== '|') {
      groups[groups.length - 1]!.isPiped = true
      isPipedNext = true
      startGroup()
      continue
    }
    if (SEPARATORS.has(char)) {
      startGroup()
      continue
    }
    if (BLANK.test(char)) {
      finishWord()
      continue
    }
    word = (word ?? '') + char
  }
  if (quote !== null) return null
  finishWord()
  return { groups: groups.filter(group => group.words.length > 0), parents }
}

type ShellContext = { readonly exported: Readonly<Record<string, string>>; readonly directory: string | null }

const FRESH_SHELL: ShellContext = { exported: {}, directory: null }

const assignmentsOf = (words: readonly string[]): Record<string, string> =>
  Object.fromEntries(
    words.flatMap(word => {
      const [, name, value] = ASSIGNMENT.exec(word) ?? []
      return name === undefined ? [] : [[name, value!]]
    }),
  )

function asCommand(words: readonly string[]): SimpleCommand {
  const firstWord = words.findIndex(word => !ASSIGNMENT.test(word))
  const split = firstWord === -1 ? words.length : firstWord
  const assignments = assignmentsOf(words.slice(0, split))
  if (words[split] !== 'env') return { assignments, words: words.slice(split) }
  const launched = asCommand(words.slice(split + 1))
  return { assignments: { ...assignments, ...launched.assignments }, words: launched.words }
}

function normalized(path: string): string {
  const segments = path.split('/').reduce<readonly string[]>((kept, segment) => {
    if (segment === '' || segment === '.') return kept
    if (segment === '..') return kept.slice(0, -1)
    return [...kept, segment]
  }, [])
  return `${path.startsWith('/') ? '/' : ''}${segments.join('/')}`
}

function directoryAfter(directory: string | null, target: string | undefined): string | null {
  if (target === undefined) return null
  if (target.startsWith('/') || target.startsWith('~')) return normalized(target)
  return directory === null ? null : normalized(`${directory}/${target}`)
}

const withoutNames = (exported: Readonly<Record<string, string>>, names: readonly string[]) =>
  Object.fromEntries(Object.entries(exported).filter(([name]) => !names.includes(name)))

function contextAfter(command: SimpleCommand, context: ShellContext): ShellContext {
  const [program, ...rest] = command.words
  if (program === 'export') return { ...context, exported: { ...context.exported, ...assignmentsOf(rest) } }
  if (program === 'unset') return { ...context, exported: withoutNames(context.exported, rest) }
  if (program === 'cd') return { ...context, directory: directoryAfter(context.directory, rest[0]) }
  return context
}

function inContext(command: SimpleCommand, context: ShellContext): SimpleCommand {
  const [program, ...rest] = command.words
  const isRelative = program !== undefined && program.startsWith('./') && context.directory !== null
  return {
    assignments: { ...context.exported, ...command.assignments },
    words: isRelative ? [`${context.directory}/${program.slice(2)}`, ...rest] : command.words,
  }
}

type ScopeContexts = Readonly<Record<number, ShellContext>>

function contextIn(contexts: ScopeContexts, parents: readonly number[], scope: number): ShellContext {
  return contexts[scope] ?? (scope <= 0 ? FRESH_SHELL : contextIn(contexts, parents, parents[scope]!))
}

export function simpleCommands(text: string): readonly SimpleCommand[] | null {
  const script = shellWords(text)
  if (script === null) return null
  return script.groups.reduce(
    (shell, group) => {
      const command = asCommand(group.words)
      const context = contextIn(shell.contexts, script.parents, group.scope)
      return {
        contexts: group.isPiped ? shell.contexts : { ...shell.contexts, [group.scope]: contextAfter(command, context) },
        commands: [...shell.commands, inContext(command, context)],
      }
    },
    { contexts: {} as ScopeContexts, commands: [] as readonly SimpleCommand[] },
  ).commands
}

const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1)

export function programOf(command: SimpleCommand): readonly string[] {
  const [first, ...rest] = command.words
  if (first === undefined) return []
  return SHELLS.has(baseName(first)) && rest[0] !== undefined && !rest[0].startsWith('-') ? rest : command.words
}

export const isPipelineClean = (command: SimpleCommand) => {
  const [program, verb] = programOf(command)
  return program !== undefined && baseName(program) === 'pipeline' && verb === 'clean'
}

export const isRunScript = (command: SimpleCommand) => {
  const [program] = programOf(command)
  return program !== undefined && program.includes('/.mitosis/') && baseName(program) === 'run.zsh'
}

export const isShipping = (command: SimpleCommand) => (command.assignments.SHIP ?? '') !== ''
