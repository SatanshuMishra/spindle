export type SimpleCommand = {
  readonly assignments: Readonly<Record<string, string>>
  readonly words: readonly string[]
}

const SEPARATORS = new Set([';', '&', '|', '\n', '(', ')'])
const BLANK = /\s/
const ASSIGNMENT = /^([A-Za-z_][A-Za-z0-9_]*)=([\s\S]*)$/
const SHELLS = new Set(['zsh', 'bash', 'sh'])

function shellWords(text: string): readonly (readonly string[])[] | null {
  const groups: string[][] = [[]]
  let word: string | null = null
  let quote: '"' | "'" | null = null
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

function asCommand(words: readonly string[]): SimpleCommand {
  const firstWord = words.findIndex(word => !ASSIGNMENT.test(word))
  const split = firstWord === -1 ? words.length : firstWord
  const assignments = Object.fromEntries(
    words.slice(0, split).map(word => {
      const [, name, value] = ASSIGNMENT.exec(word)!
      return [name!, value!]
    }),
  )
  return { assignments, words: words.slice(split) }
}

export function simpleCommands(text: string): readonly SimpleCommand[] | null {
  const groups = shellWords(text)
  return groups === null ? null : groups.map(asCommand)
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
