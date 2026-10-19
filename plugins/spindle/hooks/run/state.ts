import type { Lane, Signals } from '../../types'

export const NO_SIGNALS: Signals = {
  lane: null,
  callStage: null,
  isCleanDone: false,
  firstCallAt: null,
  agents: [],
  isPullRequestRunning: false,
  pulls: [],
  costUsd: 0,
}

export type Json = Record<string, unknown>

export const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value)

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

export const LANE_NAME: Readonly<Record<Lane, string>> = { full: 'Full', standard: 'Standard' }
