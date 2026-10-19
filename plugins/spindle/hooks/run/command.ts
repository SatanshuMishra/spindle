export type SimpleCommand = {
  readonly assignments: Readonly<Record<string, string>>
  readonly words: readonly string[]
  readonly decidesStatus: boolean
}

const SEPARATORS = new Set([';', '&', '|', '\n', '(', ')'])
const BLANK = /\s/
const ASSIGNMENT = /^([A-Za-z_][A-Za-z0-9_]*)=([\s\S]*)$/
const PREFIX_ASSIGNMENT = /^([A-Za-z_][A-Za-z0-9_]*)\+?=/
const SHELLS = new Set(['zsh', 'bash', 'sh'])
const MODIFIERS = new Set(['command', 'builtin', 'exec', 'noglob', 'nocorrect'])

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

type Word = { readonly value: string; readonly raw: string }

type Scope = readonly string[]

type Parsed = {
  readonly words: readonly Word[]
  readonly scope: Scope
  readonly follows: string | null
  readonly isQuiet: boolean
  readonly isPiped: boolean
  readonly isNested: boolean
}

type Scan = { readonly end: number; readonly records: readonly Parsed[] }

type Span = { readonly from: number; readonly to: number }

const nested = (records: readonly Parsed[]): readonly Parsed[] =>
  records.map(record => ({ ...record, isQuiet: true, isNested: true }))

const closedAt = (end: number): Scan | null => (end === -1 ? null : { end, records: [] })

function ansiQuoteEnd(text: string, from: number): number {
  for (let index = from; index < text.length; index += 1) {
    if (text[index] === '\\') index += 1
    else if (text[index] === "'") return index
  }
  return -1
}

function backquoteEnd(text: string, from: number): number {
  for (let index = from; index < text.length; index += 1) {
    if (text[index] === '\\') index += 1
    else if (text[index] === '`') return index
  }
  return -1
}

function scanUntil(text: string, from: number, closer: string, nestsParens: boolean, scope: Scope): Scan | null {
  let depth = 0
  let records: readonly Parsed[] = []
  for (let index = from; index < text.length; index += 1) {
    const char = text[index]!
    if (char === '\\') {
      index += 1
      continue
    }
    if (char === closer && depth === 0) return { end: index, records }
    if (nestsParens && (char === '(' || char === ')')) {
      depth += char === '(' ? 1 : -1
      continue
    }
    const quoted = quotedAt(text, index, scope)
    if (quoted === null) return null
    if (quoted !== undefined) {
      records = [...records, ...quoted.records]
      index = quoted.end
    }
  }
  return null
}

function doubleQuoted(text: string, open: number, scope: Scope): Scan | null {
  let records: readonly Parsed[] = []
  for (let index = open + 1; index < text.length; index += 1) {
    const char = text[index]!
    if (char === '\\') {
      index += 1
      continue
    }
    if (char === '"') return { end: index, records }
    const expansion = expansionAt(text, index, scope)
    if (expansion === null) return null
    if (expansion !== undefined) {
      records = [...records, ...expansion.records]
      index = expansion.end
    }
  }
  return null
}

function quotedAt(text: string, index: number, scope: Scope): Scan | null | undefined {
  const char = text[index]
  if (char === "'") return closedAt(text.indexOf("'", index + 1))
  if (char === '"') return doubleQuoted(text, index, scope)
  if (char === '$' && text[index + 1] === "'") return closedAt(ansiQuoteEnd(text, index + 2))
  return expansionAt(text, index, scope)
}

function expansionAt(text: string, index: number, scope: Scope): Scan | null | undefined {
  const char = text[index]
  const next = text[index + 1]
  if (char === '`') return backquoted(text, index, scope)
  if (char !== '$') return undefined
  if (next === '{') return scanUntil(text, index + 2, '}', false, scope)
  if (next === '[') return scanUntil(text, index + 2, ']', false, scope)
  if (next !== '(') return undefined
  if (text[index + 2] === '(') return arithmetic(text, index + 1, scope) ?? substituted(text, index + 2, scope)
  return substituted(text, index + 2, scope)
}

function arithmetic(text: string, open: number, scope: Scope): Scan | null {
  const inner = scanUntil(text, open + 2, ')', true, scope)
  return inner !== null && text[inner.end + 1] === ')' ? { end: inner.end + 1, records: inner.records } : null
}

function substituted(text: string, from: number, scope: Scope): Scan | null {
  const script = parseScript(text, from, ')', [...scope, `$${from}`])
  return script === null ? null : { end: script.end, records: nested(script.records) }
}

function backquoted(text: string, open: number, scope: Scope): Scan | null {
  const end = backquoteEnd(text, open + 1)
  if (end === -1) return null
  const inner = text.slice(open + 1, end).replace(/\\([\\`$])/g, '$1')
  const script = parseScript(inner, 0, null, [...scope, `\`${open}`])
  return script === null ? null : { end, records: nested(script.records) }
}

const unquotedDouble = (inner: string) => inner.replace(/\\\n/g, '').replace(/\\([$`"\\])/g, '$1')

function nextNonBlank(text: string, from: number): number {
  let index = from
  while (text[index] === ' ' || text[index] === '\t') index += 1
  return index
}

const within = (spans: readonly Span[], at: number) => spans.some(span => at >= span.from && at < span.to)

type FrameKind = 'base' | 'subshell' | 'brace' | 'if' | 'loop' | 'case'

type FrameMode = 'commands' | 'header' | 'subject' | 'pattern'

type Frame = {
  readonly kind: FrameKind
  readonly scope: Scope
  readonly isDefinition: boolean
  readonly mode: FrameMode
  readonly pipelineStart: number
  readonly elementStart: number
  readonly isPipedIn: boolean
  readonly negatedFrom: number | null
  readonly conditionFrom: number | null
}

type Script = { readonly records: readonly Parsed[]; readonly end: number }

function parseScript(text: string, from: number, closer: ')' | null, scope: Scope): Script | null {
  const records: Parsed[] = []
  const quietSpans: Span[] = []
  const pipedSpans: Span[] = []
  let frames: readonly Frame[] = [
    {
      kind: 'base',
      scope,
      isDefinition: false,
      mode: 'commands',
      pipelineStart: 0,
      elementStart: 0,
      isPipedIn: false,
      negatedFrom: null,
      conditionFrom: null,
    },
  ]
  let words: Word[] = []
  let value: string | null = null
  let raw = ''
  let pending: readonly Heredoc[] = []
  let follows: string | null = null
  let isRedirecting = false
  let isAfterTime = false
  let definition: 'none' | 'name' | 'body' = 'none'
  let isBroken = false
  let isAtLinebreak = true
  let index = from

  const top = () => frames[frames.length - 1]!
  const setTop = (change: Partial<Frame>) => {
    frames = [...frames.slice(0, -1), { ...top(), ...change }]
  }
  const append = (rawPart: string, valuePart: string) => {
    raw += rawPart
    value = (value ?? '') + valuePart
  }
  const appendScan = (scan: Scan) => {
    if (!top().isDefinition) records.push(...scan.records)
    const scanned = text.slice(index, scan.end + 1)
    append(scanned, scanned)
    index = scan.end
  }
  const open = (kind: FrameKind, mode: FrameMode, conditionFrom: number | null) => {
    const outer = top()
    frames = [
      ...frames,
      {
        kind,
        scope: kind === 'subshell' ? [...outer.scope, `(${index}`] : outer.scope,
        isDefinition: outer.isDefinition || definition === 'body',
        mode,
        pipelineStart: records.length,
        elementStart: records.length,
        isPipedIn: false,
        negatedFrom: null,
        conditionFrom,
      },
    ]
    definition = 'none'
    isAtLinebreak = true
  }
  const endCondition = () => {
    const { conditionFrom } = top()
    if (conditionFrom !== null) quietSpans.push({ from: conditionFrom, to: records.length })
    setTop({ conditionFrom: null })
  }
  const endPipeline = () => {
    const frame = top()
    const to = records.length
    if (frame.isPipedIn) pipedSpans.push({ from: frame.elementStart, to })
    if (frame.negatedFrom !== null) quietSpans.push({ from: frame.negatedFrom, to })
    setTop({ pipelineStart: to, elementStart: to, isPipedIn: false, negatedFrom: null })
  }
  const close = (kind: FrameKind) => {
    if (top().kind !== kind) {
      isBroken = true
      return
    }
    endPipeline()
    endCondition()
    frames = frames.slice(0, -1)
    isAtLinebreak = false
  }
  const expectFrame = (kind: FrameKind, then: () => void) => {
    if (top().kind === kind) then()
    else isBroken = true
  }
  const isReserved = (word: string): boolean => {
    switch (word) {
      case '!':
        if (top().negatedFrom === null) setTop({ negatedFrom: records.length })
        return true
      case 'time':
        isAfterTime = true
        return true
      case '{':
        open('brace', 'commands', null)
        return true
      case '}':
        close('brace')
        return true
      case 'if':
        open('if', 'commands', records.length)
        return true
      case 'while':
      case 'until':
        open('loop', 'commands', records.length)
        return true
      case 'for':
      case 'select':
        open('loop', 'header', null)
        return true
      case 'case':
        open('case', 'subject', null)
        return true
      case 'elif':
        expectFrame('if', () => setTop({ conditionFrom: records.length }))
        isAtLinebreak = true
        return true
      case 'then':
        expectFrame('if', endCondition)
        isAtLinebreak = true
        return true
      case 'else':
        expectFrame('if', () => undefined)
        isAtLinebreak = true
        return true
      case 'do':
        expectFrame('loop', endCondition)
        isAtLinebreak = true
        return true
      case 'fi':
        close('if')
        return true
      case 'done':
        close('loop')
        return true
      case 'esac':
        close('case')
        return true
      case 'function':
        definition = 'name'
        return true
      default:
        return false
    }
  }
  const finishWord = () => {
    if (value === null) return
    isAtLinebreak = false
    const word: Word = { value, raw }
    value = null
    raw = ''
    if (isRedirecting) {
      isRedirecting = false
      return
    }
    const { mode } = top()
    if (mode === 'subject') {
      if (word.raw === 'in') setTop({ mode: 'pattern' })
      return
    }
    if (mode === 'pattern') {
      if (word.raw === 'esac') close('case')
      return
    }
    if (mode === 'header') {
      if (word.raw === 'do') setTop({ mode: 'commands' })
      return
    }
    if (definition === 'name') {
      definition = 'body'
      return
    }
    if (words.length === 0) {
      const followsTime = isAfterTime
      isAfterTime = false
      if (followsTime && word.raw === '-p') return
      if (isReserved(word.raw)) return
    }
    definition = 'none'
    words.push(word)
  }
  const finishCommand = () => {
    finishWord()
    isRedirecting = false
    isAfterTime = false
    if (words.length > 0 && !top().isDefinition) {
      records.push({ words, scope: top().scope, follows, isQuiet: false, isPiped: false, isNested: false })
    }
    words = []
  }
  const finishBeforeRedirect = () => {
    if (value !== null && /^\d+$/.test(raw)) {
      value = null
      raw = ''
    } else finishWord()
  }
  const pipe = () => {
    finishCommand()
    if (top().mode === 'pattern') return
    const span = { from: top().elementStart, to: records.length }
    quietSpans.push(span)
    pipedSpans.push(span)
    setTop({ elementStart: records.length, isPipedIn: true })
    isAtLinebreak = true
  }
  const list = (operator: string) => {
    finishCommand()
    if (operator === '&') quietSpans.push({ from: top().pipelineStart, to: records.length })
    endPipeline()
    follows = operator
    isAtLinebreak = true
    if (operator === ';;' || operator === ';;&' || operator === ';&') {
      if (top().kind === 'case' && top().mode === 'commands') setTop({ mode: 'pattern' })
      else isBroken = true
    }
  }
  const script = (end: number): Script | null => {
    if (isBroken || frames.length > 1) return null
    endPipeline()
    return {
      end,
      records: records.map((record, at) => ({
        ...record,
        isQuiet: record.isQuiet || within(quietSpans, at),
        isPiped: record.isPiped || within(pipedSpans, at),
      })),
    }
  }

  for (; index < text.length; index += 1) {
    const char = text[index]!
    const next = text[index + 1]
    if (char === '\\') {
      if (next === undefined) append(char, char)
      else if (next !== '\n') append(char + next, next)
      index += 1
      continue
    }
    if (char === "'") {
      const end = text.indexOf("'", index + 1)
      if (end === -1) return null
      append(text.slice(index, end + 1), text.slice(index + 1, end))
      index = end
      continue
    }
    if (char === '"') {
      const scan = doubleQuoted(text, index, top().scope)
      if (scan === null) return null
      if (!top().isDefinition) records.push(...scan.records)
      append(text.slice(index, scan.end + 1), unquotedDouble(text.slice(index + 1, scan.end)))
      index = scan.end
      continue
    }
    if (char === '$' && next === "'") {
      const end = ansiQuoteEnd(text, index + 2)
      if (end === -1) return null
      append(text.slice(index, end + 1), text.slice(index + 2, end).replace(/\\([\s\S])/g, '$1'))
      index = end
      continue
    }
    const expansion = expansionAt(text, index, top().scope)
    if (expansion === null) return null
    if (expansion !== undefined) {
      appendScan(expansion)
      continue
    }
    if (char === '#' && value === null) {
      const found = text.indexOf('\n', index)
      index = (found === -1 ? text.length : found) - 1
      continue
    }
    if (text.startsWith('<<<', index)) {
      finishBeforeRedirect()
      isRedirecting = true
      index += 2
      continue
    }
    if (char === '<' && next === '<') {
      finishBeforeRedirect()
      const { heredoc, end } = heredocDelimiter(text, index + 2)
      pending = [...pending, heredoc]
      index = end
      continue
    }
    if ((char === '<' || char === '>') && next === '(') {
      const scan = substituted(text, index + 2, top().scope)
      if (scan === null) return null
      appendScan(scan)
      continue
    }
    if (char === '<' || char === '>') {
      finishBeforeRedirect()
      isRedirecting = true
      if (next === '>' || next === '&' || next === '|') index += 1
      continue
    }
    if (char === '&' && next === '>') {
      finishBeforeRedirect()
      isRedirecting = true
      index += text[index + 2] === '>' ? 2 : 1
      continue
    }
    if (char === '&' && next === '&') {
      list('&&')
      index += 1
      continue
    }
    if (char === '|' && next === '|') {
      list('||')
      index += 1
      continue
    }
    if (char === '|') {
      pipe()
      if (next === '&') index += 1
      continue
    }
    if (char === '&') {
      list('&')
      continue
    }
    if (char === ';') {
      const operator = next === ';' ? (text[index + 2] === '&' ? ';;&' : ';;') : next === '&' ? ';&' : ';'
      list(operator)
      index += operator.length - 1
      continue
    }
    if (char === '\n') {
      finishWord()
      if (!isAtLinebreak) list('\n')
      if (pending.length > 0) {
        index = skipHeredocBodies(text, index, pending)
        pending = []
      }
      continue
    }
    if (char === '(') {
      if (top().mode === 'pattern') {
        finishWord()
        continue
      }
      if (value === null && next === '(') {
        const scan = arithmetic(text, index, top().scope)
        if (scan !== null) {
          appendScan(scan)
          continue
        }
      }
      if (value !== null || words.length > 0 || definition === 'body') {
        const closing = nextNonBlank(text, index + 1)
        if (text[closing] === ')') {
          value = null
          raw = ''
          words = []
          definition = 'body'
          index = closing
          continue
        }
        if (definition !== 'body') {
          const scan = scanUntil(text, index + 1, ')', true, top().scope)
          if (scan === null) return null
          appendScan(scan)
          continue
        }
      }
      open('subshell', 'commands', null)
      continue
    }
    if (char === ')') {
      if (top().mode === 'pattern') {
        finishWord()
        if (top().mode === 'pattern') {
          setTop({ mode: 'commands' })
          continue
        }
      }
      finishCommand()
      if (top().kind === 'subshell') {
        close('subshell')
        continue
      }
      if (closer === ')' && frames.length === 1) return script(index)
      return null
    }
    if (BLANK.test(char)) {
      finishWord()
      continue
    }
    append(char, char)
  }
  if (closer !== null) return null
  finishCommand()
  return script(text.length)
}

type ShellContext = { readonly exported: Readonly<Record<string, string>>; readonly directory: string | null }

const FRESH_SHELL: ShellContext = { exported: {}, directory: null }

type Launch = { readonly assignments: Readonly<Record<string, string>>; readonly words: readonly string[] }

const assignmentsOf = (words: readonly string[]): Record<string, string> =>
  Object.fromEntries(
    words.flatMap(word => {
      const [, name, value] = ASSIGNMENT.exec(word) ?? []
      return name === undefined ? [] : [[name, value!]]
    }),
  )

function asCommand(words: readonly Word[], takesAssignments: boolean): Launch {
  const firstWord = takesAssignments ? words.findIndex(word => !PREFIX_ASSIGNMENT.test(word.raw)) : 0
  const split = firstWord === -1 ? words.length : firstWord
  const assignments = Object.fromEntries(
    words.slice(0, split).map(word => {
      const [prefix, name] = PREFIX_ASSIGNMENT.exec(word.raw)!
      return [name!, word.value.slice(prefix.length)]
    }),
  )
  const program = words[split]?.value
  if (program !== 'env' && (program === undefined || !MODIFIERS.has(program))) {
    return { assignments, words: words.slice(split).map(word => word.value) }
  }
  const launched = asCommand(words.slice(split + 1), program === 'env')
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

function contextAfter(command: Launch, context: ShellContext): ShellContext {
  const [program, ...rest] = command.words
  if (program === 'export') return { ...context, exported: { ...context.exported, ...assignmentsOf(rest) } }
  if (program === 'unset') return { ...context, exported: withoutNames(context.exported, rest) }
  if (program === 'cd') return { ...context, directory: directoryAfter(context.directory, rest[0]) }
  return context
}

function inContext(command: Launch, context: ShellContext): Launch {
  const [program, ...rest] = command.words
  const isRelative = program !== undefined && program.startsWith('./') && context.directory !== null
  return {
    assignments: { ...context.exported, ...command.assignments },
    words: isRelative ? [`${context.directory}/${program.slice(2)}`, ...rest] : command.words,
  }
}

type ScopeContexts = Readonly<Record<string, ShellContext>>

const scopeKey = (scope: Scope) => scope.join(' ')

function contextIn(contexts: ScopeContexts, scope: Scope): ShellContext {
  return contexts[scopeKey(scope)] ?? (scope.length === 0 ? FRESH_SHELL : contextIn(contexts, scope.slice(0, -1)))
}

export function simpleCommands(text: string): readonly SimpleCommand[] | null {
  const script = parseScript(text, 0, null, [])
  if (script === null) return null
  const { records } = script
  return records.reduce(
    (shell, record, at) => {
      const command = asCommand(record.words, true)
      const context = contextIn(shell.contexts, record.scope)
      const decidesStatus =
        !record.isQuiet && records.slice(at + 1).every(later => later.isNested || later.follows === '&&')
      return {
        contexts: record.isPiped
          ? shell.contexts
          : { ...shell.contexts, [scopeKey(record.scope)]: contextAfter(command, context) },
        commands: [...shell.commands, { ...inContext(command, context), decidesStatus }],
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
  return program !== undefined && normalized(program).includes('/.mitosis/') && baseName(program) === 'run.zsh'
}

export const isShipping = (command: SimpleCommand) => (command.assignments.SHIP ?? '') !== ''
