import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import type { Fixture } from './harness'
import { harness } from './harness'
import { H, NOW, R, committedMsp, endedLane, fix, green, review, stateWith, withFile } from './fixtures/runs'

const MIN = 60_000
const LIMITER_TREE = '/home/owner/.mitosis/runs/api/rate-limit-api/trees/limiter-core'

const paneProps = (bodyColumns: number) =>
  ({ title: '', isFocused: false, bodyColumns, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} }) as const

const mountPane = ($: Engine, surface: 'desktop' | 'terminal', bodyColumns = 100) =>
  $.ui.mount({ plugin: 'spindle', surface, component: 'Pane', requestId: 'spindle-run', props: paneProps(bodyColumns) })

type Drawn = { type?: string; props?: Record<string, unknown>; children?: readonly unknown[] }

const isDrawn = (value: unknown): value is Drawn => typeof value === 'object' && value !== null && 'type' in value

const isCard = (node: Drawn) => node.type === 'Box' && node.props?.display === 'none'

const nodesOf = (value: unknown): Drawn[] =>
  Array.isArray(value)
    ? value.flatMap(nodesOf)
    : isDrawn(value) && !isCard(value)
      ? [value, ...(value.children ?? []).flatMap(nodesOf)]
      : []

const textOf = (node: Drawn) => (node.children ?? []).filter(child => typeof child === 'string').join('')

const keyOf = (node: Drawn) => String(node.props?.key ?? '')

const textsOf = (value: unknown) => nodesOf(value).filter(node => node.type === 'Text').map(textOf)

const WORKER_ROW = /^worker-.+-\d+$/

const flatChildren = (value: unknown): Drawn[] => (Array.isArray(value) ? value.flatMap(flatChildren) : isDrawn(value) ? [value] : [])

function workerList(tree: unknown): string[] {
  const workers = nodesOf(tree).find(node => keyOf(node) === 'pane-workers')
  return flatChildren(workers?.children ?? [])
    .filter(node => node.type === 'Text' || WORKER_ROW.test(keyOf(node)))
    .map(node => (node.type === 'Text' ? textOf(node) : (textsOf(node)[1] ?? '')))
}

const roleLines = (tree: unknown) =>
  nodesOf(tree)
    .filter(node => node.type === 'Box' && WORKER_ROW.test(keyOf(node)))
    .map(row => textsOf(nodesOf(row).find(node => keyOf(node) === `${keyOf(row)}-role`)).join(' '))

const limiterBuilding: Fixture = withFile(
  withFile(fix, `${H}/review/round-1/limiter-core.findings.json`, [{ id: 'C1', source: 'code-reviewer' }], NOW - 90_000),
  `${R}/state.json`,
  stateWith(
    { '0': endedLane(0, 0, 'ok', 4), '2': endedLane(2, 1, 'ok', 3), '3': endedLane(3, 2, 'ok', 3) },
    {
      '1': committedMsp('redis-store', '', null, false),
      '2': committedMsp('headers-docs', '', null, false),
    },
  ),
  NOW - 2 * MIN,
)

const redisBuilding: Fixture = withFile(
  review,
  `${R}/state.json`,
  stateWith(
    { '0': endedLane(0, 0, 'ok', 4), '1': endedLane(1, 0, 'ok', 3), '3': endedLane(3, 2, 'ok', 3) },
    {
      '0': committedMsp('limiter-core', '', null, true),
      '2': committedMsp('headers-docs', '', null, false),
    },
  ),
  NOW - 2 * MIN,
)

test('a selected MSP shows Working then Done', async ($, on) => {
  const world = harness(on, limiterBuilding, { now: NOW })
  await world.start($)

  const pane = await mountPane($, 'desktop')
  await pane.press({ key: 'msp-limiter-core' })

  expect(workerList(await pane.drawn())).toEqual([
    'Working · 1',
    'Lane 1 · building',
    'Done · 3',
    'Round 1',
    'Round 1 · code-reviewer · 1 finding',
    'Round 1',
    'Build',
    'Lane 0 · done',
  ])
})

test('a selected MSP with nothing live shows an empty Working section', async ($, on) => {
  const world = harness(on, green, { now: NOW })
  await world.start($)

  const pane = await mountPane($, 'desktop')
  await pane.press({ key: 'msp-limiter-core' })

  expect(workerList(await pane.drawn())).toEqual([
    'Working · 0',
    'Ship · waiting for pull request · run by the main thread',
    'Done · 4',
    'Round 2',
    'Round 2',
    'Round 1',
    'Round 1',
    'Build',
    'Lane 0 · done',
    'Lane 1 · done',
  ])
})

test('unselected Working now tags each live worker with its MSP', async ($, on) => {
  const world = harness(on, redisBuilding, { now: NOW })
  world.queueSpawn({ agentId: 'a-review', model: 'claude-opus-5-5' })
  await world.start($)
  await $.agent.spawn({
    tool_use_id: 'tool-review',
    prompt: `Review the diff in ${LIMITER_TREE} against the spec.`,
    description: 'review the worktree',
    subagentType: 'code-reviewer',
    provider: 'engine',
    parentModel: 'claude-opus-5-5',
    background: false,
    fork: false,
  } as never)

  const pane = await mountPane($, 'desktop')
  const tree = await pane.drawn()

  expect(textsOf(tree)).toContain('Working now')
  expect(roleLines(tree)).toEqual(['Detective · limiter-core', 'Builder · redis-store'])
})

test('terminal pane shows the Working and Done headings', async ($, on) => {
  const world = harness(on, limiterBuilding, { now: NOW })
  await world.start($)

  const pane = await mountPane($, 'terminal', 80)
  await pane.press({ key: 'msp-limiter-core' })
  const texts = textsOf(await pane.drawn())

  expect(texts.filter(text => text.startsWith('Working · 1'))).toHaveLength(1)
  expect(texts.filter(text => text.startsWith('Done · '))).toHaveLength(1)
  expect(texts.findIndex(text => text.startsWith('Working · 1'))).toBeLessThan(texts.findIndex(text => text.startsWith('Done · ')))
})
