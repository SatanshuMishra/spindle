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

function arithmeticEnd(text: string, open: number): number {
  let depth = 0
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === '(') depth += 1
    else if (text[index] === ')') depth -= 1
    if (depth === 0) return index
  }
  return -1
}

function shellWords(text: string): readonly (readonly string[])[] | null {
  const groups: string[][] = [[]]
  let word: string | null = null
  let quote: '"' | "'" | null = null
  let pending: Heredoc[] = []
  const finishWord = () => {
    if (word !== null) groups[groups.length - 1]!.push(word)
    word = null
  }
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!
    const following = text[index + 1]
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
      const end = arithmeticEnd(text, index)
      if (end === -1) return null
      word = (word ?? '') + text.slice(index, end + 1)
      index = end
      continue
    }
    if (char === '<' && following === '<' && text[index + 2] !== '<') {
      finishWord()
      const { heredoc, end } = heredocDelimiter(text, index + 2)
      pending = [...pending, heredoc]
      index = end
      continue
    }
    if (char === '\n' && pending.length > 0) {
      finishWord()
      groups.push([])
      index = skipHeredocBodies(text, index, pending)
      pending = []
      continue
    }
    if (SEPARATORS.has(char)) {
      finishWord()
      groups.push([])
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
  return groups.filter(group => group.length > 0)
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

function directoryAfter(directory: string | null, target: string | undefined): string | null {
  if (target === undefined) return null
  if (target.startsWith('/') || target.startsWith('~')) return target
  return directory === null ? null : `${directory}/${target}`
}

function contextAfter(command: SimpleCommand, context: ShellContext): ShellContext {
  const [program, ...rest] = command.words
  if (program === 'export') return { ...context, exported: { ...context.exported, ...assignmentsOf(rest) } }
  if (program === 'cd') return { ...context, directory: directoryAfter(context.directory, rest[0]) }
  return context
}

function inContext(command: SimpleCommand, context: ShellContext): SimpleCommand {
  const [program, ...rest] = command.words
  const isRelative = program !== undefined && program.startsWith('./') && context.directory !== null
  return {
    assignments: { ...context.exported, ...command.assignments },
    words: isRelative ? [`${context.directory}${program.slice(1)}`, ...rest] : command.words,
  }
}

export function simpleCommands(text: string): readonly SimpleCommand[] | null {
  const groups = shellWords(text)
  if (groups === null) return null
  return groups.map(asCommand).reduce(
    (shell, command) => ({
      context: contextAfter(command, shell.context),
      commands: [...shell.commands, inContext(command, shell.context)],
    }),
    { context: FRESH_SHELL, commands: [] as readonly SimpleCommand[] },
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
