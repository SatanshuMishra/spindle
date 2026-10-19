import { atom, read, update } from 'claude-code'
import type { Hook, StateDollar } from 'claude-code'

import type { AgentRow, Lane, Role, Signals, Stage } from '../../types'
import { contextMax, contextTokens, stepCost } from './cost'
import { STAGES } from './infer'
import { NO_SIGNALS, refresh } from './view'

const MAX_AGENTS = 200

const signalsState = atom({ plugin: 'spindle', key: 'signals' } as const, NO_SIGNALS)
const filesState = atom({ plugin: 'spindle', key: 'files' } as const, null)

type CallSignal = {
  stage: Stage | null
  lane: Lane | null
  isPullRequest: boolean
  isClean: boolean
}

const NO_CALL: CallSignal = { stage: null, lane: null, isPullRequest: false, isClean: false }

const ROLES: readonly (readonly [RegExp, Role])[] = [
  [/^interphase:(scout|spec-reviewer)$/, 'scribe'],
  [/^(?:[^:]+:)?(code-reviewer|security-reviewer|conformance-auditor)$/, 'detective'],
  [/^(?:[^:]+:)?validator$/, 'judge'],
]

export const roleOf = (type: string): Role => ROLES.find(([pattern]) => pattern.test(type))?.[1] ?? 'plain'

const textOf = (value: unknown) => (typeof value === 'string' ? value : '')

function laneOf(args: string): Lane | null {
  const trimmed = args.trim()
  if (trimmed.endsWith('Interview me first.')) return 'full'
  if (trimmed.endsWith('Work autonomously.')) return 'standard'
  return null
}

function callSignal(tool: string, input: Readonly<Record<string, unknown>>): CallSignal {
  if (tool === 'Skill') {
    const skill = textOf(input.skill)
    if (skill.startsWith('interphase:')) return { ...NO_CALL, stage: 'spec', lane: laneOf(textOf(input.args)) }
    if (skill === 'pipeline:run') return { ...NO_CALL, stage: 'spec' }
    if (skill === 'lighthouse:test') return { ...NO_CALL, stage: 'integrate' }
    return NO_CALL
  }
  if (tool === 'Bash') {
    const command = textOf(input.command)
    if (command.includes('pipeline clean')) return { ...NO_CALL, stage: 'clean', isClean: true }
    if (command.includes('/.mitosis/') && command.includes('/run.zsh')) {
      return { ...NO_CALL, stage: command.includes('SHIP=1') ? 'ship' : 'build' }
    }
    return NO_CALL
  }
  if (tool.endsWith('create_pull_request')) return { ...NO_CALL, stage: 'ship', isPullRequest: true }
  return NO_CALL
}

const laterStage = (known: Stage | null, reached: Stage | null): Stage | null => {
  if (reached === null) return known
  if (known === null) return reached
  return STAGES.indexOf(reached) > STAGES.indexOf(known) ? reached : known
}

function pullNumber(result: unknown): string | null {
  const text = typeof result === 'string' ? result : (JSON.stringify(result) ?? '')
  return /\/pull\/(\d+)/.exec(text)?.[1] ?? /"number":(\d+)/.exec(text)?.[1] ?? null
}

function exitedClean(ran: { deny?: string; isError?: boolean; result?: unknown }): boolean {
  if (ran.deny !== undefined || ran.isError === true) return false
  const result = ran.result
  const exitCode = typeof result === 'object' && result !== null ? (result as { exitCode?: unknown }).exitCode : undefined
  return exitCode === undefined || exitCode === 0
}

async function change($: StateDollar, apply: (signals: Signals) => Signals): Promise<void> {
  await update($, signalsState, apply)
  await refresh($)
}

export const toolCallSignals: Hook<'tool.call'> = async ($, e, next) => {
  const input = e as unknown as Readonly<Record<string, unknown>>
  const signal = callSignal(String(e.tool), input)
  if (signal.stage === null) return next(e)
  const at = await $.clock.now()
  await change($, signals => ({
    ...signals,
    callStage: laterStage(signals.callStage, signal.stage),
    lane: signals.lane ?? signal.lane,
    firstCallAt: signals.firstCallAt ?? at,
    isPullRequestRunning: signals.isPullRequestRunning || signal.isPullRequest,
  }))
  const ran = await next(e)
  if (signal.isClean && exitedClean(ran)) {
    await change($, signals => ({ ...signals, isCleanDone: true }))
  }
  if (signal.isPullRequest) {
    const head = input.head
    const number = ran.deny === undefined ? pullNumber(ran.result) : null
    await change($, signals => ({
      ...signals,
      isPullRequestRunning: false,
      pulls:
        typeof head === 'string' && number !== null
          ? [...signals.pulls.filter(pull => pull.head !== head), { head, number }]
          : signals.pulls,
    }))
  }
  return ran
}

export const agentSpawnSignals: Hook<'agent.spawn'> = async ($, e, next) => {
  const started = await next(e)
  if (started.deny !== undefined) return started
  const at = await $.clock.now()
  const agent: AgentRow = {
    id: started.agentId ?? e.tool_use_id,
    role: roleOf(e.subagentType),
    type: e.subagentType,
    description: e.description,
    model: started.model,
    startedAt: at,
    contextTokens: 0,
    contextMax: contextMax(started.model),
    isRunning: true,
  }
  await change($, signals => ({
    ...signals,
    agents: [...signals.agents.filter(one => one.id !== agent.id), agent].slice(-MAX_AGENTS),
  }))
  return started
}

export const turnStepSignals: Hook<'turn.step'> = async function* ($, e, next) {
  const result = yield* next(e)
  const usage = result.usage
  if (usage === null) return result
  const model = usage.model || e.model
  const [signals, files] = await Promise.all([read($, signalsState), read($, filesState)])
  const isRunKnown = signals.firstCallAt !== null || files !== null
  const agentId = e.agentId
  await change($, current => ({
    ...current,
    costUsd: isRunKnown ? current.costUsd + stepCost(model, usage) : current.costUsd,
    agents:
      agentId === undefined
        ? current.agents
        : current.agents.map(agent =>
            agent.id === agentId
              ? { ...agent, model, contextTokens: contextTokens(usage), contextMax: contextMax(model) }
              : agent,
          ),
  }))
  return result
}

export const turnCompleteSignals: Hook<'turn.complete'> = async ($, e, next) => {
  const agentId = e.agentId
  if (agentId !== undefined) {
    await change($, signals => ({
      ...signals,
      agents: signals.agents.map(agent => (agent.id === agentId ? { ...agent, isRunning: false } : agent)),
    }))
  }
  return next(e)
}
