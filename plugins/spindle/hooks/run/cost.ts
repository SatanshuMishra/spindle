import type { ModelUsage } from 'claude-code'

type Price = { input: number; output: number; cacheRead: number; cacheWrite: number }

const price = (input: number, output: number, cacheRead: number, cacheWrite: number): Price => ({
  input,
  output,
  cacheRead,
  cacheWrite,
})

const HAIKU_5_5_LONG = price(0.5, 2.5, 0.05, 1)
const HAIKU_5_5_LONG_PROMPT = 100_000

const PRICES: readonly (readonly [RegExp, Price])[] = [
  [/(fable|mythos)-5-1/, price(10, 50, 0.25, 20)],
  [/fable|mythos/, price(10, 50, 1, 20)],
  [/opus-5-5/, price(4, 20, 0.2, 8)],
  [/opus/, price(5, 25, 0.5, 10)],
  [/sonnet-5-5/, price(2, 10, 0.1, 4)],
  [/sonnet-5/, price(2, 10, 0.2, 4)],
  [/sonnet/, price(3, 15, 0.3, 6)],
  [/haiku-5-5/, price(0.1, 0.5, 0.01, 0.2)],
  [/haiku/, price(1, 5, 0.1, 2)],
]

const FALLBACK = price(4, 20, 0.2, 8)

const promptTokens = (usage: ModelUsage) =>
  (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0)

function priceOf(model: string, usage: ModelUsage): Price {
  const found = PRICES.find(([pattern]) => pattern.test(model))
  if (found === undefined) return FALLBACK
  const [pattern, listed] = found
  return pattern.source === 'haiku-5-5' && promptTokens(usage) > HAIKU_5_5_LONG_PROMPT ? HAIKU_5_5_LONG : listed
}

export function stepCost(model: string, usage: ModelUsage): number {
  const p = priceOf(model, usage)
  return (
    ((usage.input_tokens || 0) * p.input +
      (usage.output_tokens || 0) * p.output +
      (usage.cache_read_input_tokens || 0) * p.cacheRead +
      (usage.cache_creation_input_tokens || 0) * p.cacheWrite) /
    1_000_000
  )
}

export const contextTokens = (usage: ModelUsage) => promptTokens(usage) + (usage.output_tokens || 0)

export const contextMax = (model: string) => (/haiku-4|claude-3/i.test(model) ? 200_000 : 1_000_000)
