import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { textWidth } from '../hooks/draw/text'
import { NOW, build, fireplace, fix, review, spec } from './fixtures/runs'
import { harness } from './harness'

const FIRE_SLUG = 'mac-video-audio-and-recorder-ui'
const FIRE_TIME = '15h 00m'
const SPEC_TIME = '48m'
const VIDEO = 'video-starts-like-a-camera'
const MIN = 60_000
const STAGES = ['Spec', 'Build', 'Review', 'Fix', 'Ship', 'Integrate', 'Clean-up']
const PROOF_HINT = 'Acceptance test failed without the work (red) and passed with it (green)'
const COST_HINT = "Cost of this session's model calls"

const paneProps = (bodyColumns: number) =>
  ({ title: '', isFocused: false, bodyColumns, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} }) as const

const skill = ($: Engine, name: string, args: string) => $.tool.call({ tool: 'Skill', skill: name, args } as never)

const spawn = ($: Engine, subagentType: string, description: string) =>
  $.agent.spawn({
    tool_use_id: `tool-${description}`,
    prompt: description,
    description,
    subagentType,
    provider: 'engine',
    parentModel: 'claude-opus-5-5',
    background: false,
    fork: false,
  } as never)

const mountPane = ($: Engine, surface: 'desktop' | 'terminal', bodyColumns = 100) =>
  $.ui.mount({ plugin: 'spindle', surface, component: 'Pane', requestId: 'spindle-run', props: paneProps(bodyColumns) })

type Pane = Awaited<ReturnType<typeof mountPane>>

type Drawn = { type?: string; props?: Record<string, unknown>; children?: readonly unknown[] }
type Placed = { node: Drawn; isInCard: boolean }

const isDrawn = (value: unknown): value is Drawn => typeof value === 'object' && value !== null && 'type' in value

const isCard = (node: Drawn) => node.type === 'Box' && node.props?.display === 'none'

function placedOf(value: unknown, isInCard = false): Placed[] {
  if (Array.isArray(value)) return value.flatMap(one => placedOf(one, isInCard))
  if (!isDrawn(value)) return []
  const inside = isInCard || isCard(value)
  return [{ node: value, isInCard: inside }, ...(value.children ?? []).flatMap(child => placedOf(child, inside))]
}

const textOf = (node: Drawn) => (node.children ?? []).filter(child => typeof child === 'string').join('')

const keyOf = (node: Drawn) => String(node.props?.key ?? '')

type Svg = { alt: string; width: number; source: string }

type Seen = {
  texts: readonly string[]
  cardTexts: readonly string[]
  buttons: readonly { key: string; label: string; hotkey: string }[]
  svgs: readonly Svg[]
  allSvgs: readonly Svg[]
}

const svgOf = (node: Drawn): Svg => ({
  alt: String(node.props?.alt ?? ''),
  width: Number(node.props?.width ?? 0),
  source: String(node.props?.source ?? ''),
})

function seenOf(tree: unknown): Seen {
  const placed = placedOf(tree)
  const shown = placed.filter(one => !one.isInCard).map(one => one.node)
  return {
    texts: shown.filter(node => node.type === 'Text').map(textOf),
    cardTexts: placed.filter(one => one.isInCard && one.node.type === 'Text').map(one => textOf(one.node)),
    buttons: shown
      .filter(node => node.type === 'Button')
      .map(node => ({ key: keyOf(node), label: String(node.props?.label ?? ''), hotkey: String(node.props?.hotkey ?? '') })),
    svgs: shown.filter(node => node.type === 'Svg').map(svgOf),
    allSvgs: placed.filter(one => one.node.type === 'Svg').map(one => svgOf(one.node)),
  }
}

const WORKER_ROW = /^worker-.+-\d+$/

type Row = { key: string; seen: Seen; right: Drawn | undefined }

function rowsOf(tree: unknown): Row[] {
  return placedOf(tree)
    .filter(one => !one.isInCard && one.node.type === 'Box' && WORKER_ROW.test(keyOf(one.node)))
    .map(({ node }) => ({
      key: keyOf(node),
      seen: seenOf(node),
      right: placedOf(node)
        .map(one => one.node)
        .find(one => one.type === 'Box' && keyOf(one) === `${keyOf(node)}-right`),
    }))
}

async function drawnAt($: Engine, bodyColumns = 100): Promise<unknown> {
  const pane = await mountPane($, 'desktop', bodyColumns)
  const tree = await pane.drawn()
  await pane.unmount()
  return tree
}

const mspButtons = (seen: Seen) => seen.buttons.filter(button => button.key.startsWith('msp-'))

const roundIn = (row: Row) => Number(/^Round (\d+)/.exec(row.seen.texts.find(text => /^Round \d+/.test(text)) ?? '')?.[1] ?? NaN)

const railOf = (seen: Seen) => seen.svgs.find(svg => svg.alt.startsWith('Stage '))

const railLabels = (source: string) =>
  [...source.matchAll(/<text[^>]*\sx="([\d.]+)"[^>]*font-size="([\d.]+)"[^>]*>([^<]*)<\/text>/g)].map(match => ({
    x: Number(match[1]),
    size: Number(match[2]),
    name: match[3] ?? '',
  }))

const countOf = (source: string, pattern: RegExp) => [...source.matchAll(pattern)].length

async function fireRun($: Engine, on: On) {
  const world = harness(on, fireplace, { now: NOW })
  world.queueSpawn({ agentId: 'a-judge', model: 'claude-opus-5-5' })
  world.queueSpawn({ agentId: 'a-review', model: 'claude-opus-5-5' })
  await world.start($)
  await skill($, 'interphase:feature', 'Record video like a camera. Interview me first.')
  await spawn($, 'validator', 'validate video-starts-like-a-camera')
  await spawn($, 'code-reviewer', 'review button-consistency')
  return world
}

async function fixRun($: Engine, on: On) {
  const world = harness(on, fix, { now: NOW })
  world.queueSpawn({ agentId: 'a-judge', model: 'claude-opus-5-5' })
  await world.start($)
  await skill($, 'interphase:feature', 'Add rate limits. Interview me first.')
  await spawn($, 'validator', 'validate round 1')
  return world
}

function answerContext(on: On, inputTokens: number) {
  on('turn.step', async function* () {
    return {
      turnId: 'turn-agent',
      index: 0,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn',
      usage: { model: 'claude-opus-5-5', input_tokens: inputTokens, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    } as never
  })
}

async function agentStep($: Engine, agentId: string) {
  const stream = ($.turn.step as (e: unknown) => AsyncIterable<unknown>)({ turnId: 'turn-agent', index: 0, model: 'claude-opus-5-5', messageCount: 1, agentId })
  for await (const chunk of stream) void chunk
}

const toggle = ($: Engine) => $.command.run({ command: 'spindle', args: '' } as never)

const press = async (pane: Pane, label: string) => {
  await pane.press({ key: `msp-${label}` })
}

test('the fireplace pane shows MSPs and live workers', async ($, on) => {
  await fireRun($, on)

  const tree = await drawnAt($, 100)
  const seen = seenOf(tree)

  expect(seen.texts.indexOf('Pipeline Insights')).toBeGreaterThanOrEqual(0)
  expect(seen.texts.indexOf('Pipeline Insights')).toBeLessThan(seen.texts.indexOf(FIRE_SLUG))
  expect(seen.texts.some(text => text.startsWith('~$'))).toBe(true)
  expect(seen.texts).toContain('2')
  expect(seen.texts).toContain(FIRE_TIME)
  expect(railOf(seen)?.alt).toBe('Stage Review · 1 at Review, 1 at Fix, 2 at Ship')
  expect(mspButtons(seen).map(button => button.label)).toEqual([
    'mic-recovery · Ship · pull request #329',
    'video-starts-like-a-camera · Round 5 · suite running · 7m',
    'hearing-and-ring · Ship · waiting for pull request',
    'button-consistency · Round 4 · diagnosing · 10m',
  ])
  expect(seen.texts).toContain('Working now')
  expect(rowsOf(tree).map(row => row.seen.texts[0])).toEqual(['Judge', 'Detective'])
  for (const text of seen.texts) {
    expect(text).not.toContain('Review rounds')
    expect(text).not.toMatch(/\bsession\b/)
    expect(text).not.toMatch(/\blive\b/)
  }
})

test('the main thread row carries no time', async ($, on) => {
  const world = harness(on, spec, { now: NOW })
  await world.start($)

  const tree = await drawnAt($, 100)
  const rows = rowsOf(tree)
  expect(rows.map(row => row.seen.texts)).toEqual([['Captain', 'main thread']])
  const seen = seenOf(tree)
  expect([...seen.texts, ...seen.cardTexts].filter(text => text.includes(SPEC_TIME))).toEqual([SPEC_TIME])
})

test('worker rows share one right-column edge', async ($, on) => {
  const world = harness(on, fireplace, { now: NOW - 74 * MIN })
  world.queueSpawn({ agentId: 'a-smoke', model: 'claude-sonnet-5-5' })
  world.queueSpawn({ agentId: 'a-diagnosis', model: 'claude-opus-5-5' })
  await spawn($, 'smoke', 'smoke button-consistency on windows')
  await world.clock.advance(68 * MIN)
  await spawn($, 'diagnosis', 'diagnose button-consistency round 4')
  await world.clock.advance(6 * MIN)
  await world.start($)

  const rows = rowsOf(await drawnAt($, 46))
  expect(rows.length).toBe(2)
  expect(rows.flatMap(row => row.seen.texts)).toContain('Sonnet 5.5 · 1h 14m')
  expect(rows.flatMap(row => row.seen.texts)).toContain('Opus 5.5 · 6m')
  for (const row of rows) {
    expect(row.right?.props?.width).toBe('Sonnet 5.5 · 1h 14m'.length)
    expect(row.right?.props?.alignItems).toBe('flex-start')
    const inside = seenOf(row.right)
    expect(inside.texts.length).toBe(1)
    expect(inside.svgs.length).toBe(1)
  }
})

test('a 36-column pane keeps values whole', async ($, on) => {
  const world = harness(on, fireplace, { now: NOW })
  await world.start($)

  const pane = await mountPane($, 'desktop', 36)
  const seen = seenOf(await pane.drawn())
  for (const svg of seen.allSvgs) expect(svg.width).toBeLessThanOrEqual(288)
  expect(seen.texts).toContain('~$0.00')
  expect(seen.texts).toContain(FIRE_TIME)
  const rail = railOf(seen)
  expect(railLabels(rail?.source ?? '').map(label => label.name)).toEqual(['Review'])
  const card = seenOf(await pane.find({ key: 'pane-rail-hint' })).cardTexts
  for (const stage of STAGES) expect(card.some(line => line.startsWith(stage))).toBe(true)
})

test('a 100-column rail names every stage', async ($, on) => {
  const world = harness(on, fireplace, { now: NOW })
  await world.start($)

  const rail = railOf(seenOf(await drawnAt($, 100)))
  const labels = railLabels(rail?.source ?? '')
  expect(labels.map(label => label.name)).toEqual(STAGES)
  for (const label of labels) {
    expect(label.x + textWidth(label.name, label.size) / 2).toBeLessThanOrEqual(rail?.width ?? 0)
    expect(label.x - textWidth(label.name, label.size) / 2).toBeGreaterThanOrEqual(0)
  }
})

test('marks carry hover cards', async ($, on) => {
  answerContext(on, 400_000)
  const world = harness(on, review, { now: NOW })
  world.queueSpawn({ agentId: 'a1', model: 'claude-opus-5-5' })
  await world.start($)
  await skill($, 'interphase:feature', 'Add rate limits. Interview me first.')
  await spawn($, 'code-reviewer', 'review limiter-core')
  await agentStep($, 'a1')

  const pane = await mountPane($, 'desktop', 100)
  const proof = seenOf(await pane.find({ key: 'msp-proof-limiter-core' }))
  expect(proof.texts).toEqual(['proof'])
  expect(proof.svgs.length).toBe(1)
  const cards = seenOf(await pane.drawn()).cardTexts
  expect(cards).toContain(PROOF_HINT)
  expect(cards).toContain('mitosis/limiter-core')
  expect(cards).toContain('Context 40%')
  expect(cards).toContain(COST_HINT)
})

test('press an MSP to see its workers', async ($, on) => {
  const world = await fireRun($, on)

  const pane = await mountPane($, 'desktop', 100)
  await press(pane, VIDEO)
  const tree = await pane.drawn()
  const seen = seenOf(tree)

  expect(seen.texts).toContain('video-starts-like-a-camera · workers')
  const rows = rowsOf(tree)
  expect(rows[0]?.seen.texts.slice(0, 2)).toEqual(['Judge', 'Round 5 · validating'])
  const rounds = rows.slice(1).map(roundIn).filter(n => !Number.isNaN(n))
  expect(rounds.indexOf(4)).toBeGreaterThanOrEqual(0)
  expect(rounds.indexOf(3)).toBeGreaterThan(rounds.lastIndexOf(4))
  const judged = rows.find(row => row.seen.texts[0] === 'Judge' && row.seen.texts[1] === 'Round 4')
  const verdict = judged?.seen.svgs.find(svg => svg.source.includes('data-pip'))?.source ?? ''
  expect(countOf(verdict, /<rect data-pip="blocker"[^>]*fill="#D0453F"/g)).toBe(1)
  expect(countOf(verdict, /<rect data-pip="advisory"[^>]*fill="#BA7517"/g)).toBe(1)
  expect(countOf(verdict, /<rect data-pip="other"[^>]*class="sv-k"/g)).toBe(1)
  expect(countOf(verdict, /data-pip=/g)).toBe(3)
  expect(verdict).toContain('>loop</text>')
  expect(judged?.seen.texts).toContain('take lost on sound failure')
  expect(rows.some(row => row.key.includes('button-consistency'))).toBe(false)
  expect(world.writes().filter(write => write.op === 'store.set')).toEqual([])
})

test('a second press clears the filter', async ($, on) => {
  await fireRun($, on)

  const pane = await mountPane($, 'desktop', 100)
  await press(pane, VIDEO)
  await press(pane, VIDEO)
  const tree = await pane.drawn()

  expect(seenOf(tree).texts).toContain('Working now')
  expect(rowsOf(tree).map(row => row.seen.texts.slice(0, 2))).toEqual([
    ['Judge', 'Round 5 · validating'],
    ['Detective', 'Round 4 · reviewing'],
  ])
})

test('digits select MSPs', async ($, on) => {
  await fireRun($, on)

  const pane = await mountPane($, 'desktop', 100)
  const buttons = mspButtons(seenOf(await pane.drawn()))
  expect(buttons.map(button => button.hotkey)).toEqual(['1', '2', '3', '4'])
  await pane.press({ key: buttons.find(button => button.hotkey === '4')?.key ?? '' })

  expect(seenOf(await pane.drawn()).texts).toContain('button-consistency · workers')
})

test('selection survives a refresh and a reopen', async ($, on) => {
  const world = await fireRun($, on)
  await toggle($)

  const pane = await mountPane($, 'desktop', 100)
  await press(pane, VIDEO)
  await pane.unmount()
  await world.clock.advance(2000)
  expect(seenOf(await drawnAt($)).texts).toContain('video-starts-like-a-camera · workers')

  await toggle($)
  await toggle($)
  expect(world.closed()).toContain('spindle-run')
  expect(seenOf(await drawnAt($)).texts).toContain('video-starts-like-a-camera · workers')
})

test('a new run clears the selection', async ($, on) => {
  const world = await fireRun($, on)

  const pane = await mountPane($, 'desktop', 100)
  await press(pane, VIDEO)
  await pane.unmount()
  world.use(fix)
  await world.clock.advance(2000)

  const texts = seenOf(await drawnAt($)).texts
  expect(texts).toContain('Working now')
  expect(texts.some(text => text.endsWith('· workers'))).toBe(false)
})

test('desktop pane at Fix shows every section', async ($, on) => {
  await fixRun($, on)

  const tree = await drawnAt($, 100)
  const seen = seenOf(tree)
  expect(seen.texts).toContain('rate-limit-api')
  expect(seen.texts).toContain('Full lane')
  expect(railOf(seen)?.alt).toBe('Stage Fix · 1 at Fix, 2 at Ship')
  expect(mspButtons(seen).map(button => button.label.split(' · ')[0])).toEqual(['limiter-core', 'redis-store', 'headers-docs'])
  expect(rowsOf(tree).map(row => row.seen.texts[0])).toEqual(['Judge'])
})

test('terminal pane at Fix shows the same words', async ($, on) => {
  await fixRun($, on)

  const pane = await mountPane($, 'terminal')
  const texts = (await pane.findAll({ type: 'Text' })).map(one => String(one.text ?? ''))
  const labels = (await pane.findAll({ type: 'Button' })).map(one => String(one.props.label ?? ''))
  const text = [...texts, ...labels].join('\n')
  for (const word of ['Pipeline Insights', 'limiter-core', 'Fixing', 'redis-store', 'Green', 'Judge', 'Working now', '~$', 'Stage Fix']) {
    expect(text).toContain(word)
  }
  expect(text).not.toContain('Review rounds')
  expect((await pane.findAll({ type: 'Svg' })).length).toBe(0)
})

test('build pane shows the Builder row and proof dots', async ($, on) => {
  const world = harness(on, build, { now: NOW })
  await world.start($)

  expect(rowsOf(await drawnAt($)).map(row => row.seen.texts[0])).toContain('Builder')

  world.use(review)
  await world.clock.advance(2000)

  const pane = await mountPane($, 'desktop')
  const proof = seenOf(await pane.find({ key: 'msp-proof-limiter-core' }))
  expect(proof.svgs[0]?.source ?? '').toContain('fill="#D0453F"')
})
