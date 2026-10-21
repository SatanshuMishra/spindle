import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { FH, NOW, build, fireplace, fix, review, spec, withFile } from './fixtures/runs'
import { harness } from './harness'

const FIRE_SLUG = 'mac-video-audio-and-recorder-ui'
const FIRE_TIME = '15h 00m'
const SPEC_TIME = '48m'
const VIDEO = 'video-starts-like-a-camera'
const MIN = 60_000
const PROOF_HINT = 'Acceptance test failed without the work (red)'
const TIME_HINT = 'Time since the run started'
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

type Drawn = { type?: string; props?: Record<string, unknown>; hover?: { scope?: string; display?: string }; children?: readonly unknown[] }
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

const buttonLabel = (node: Drawn) => String(node.props?.label ?? '').replace(/^\d /, '').replace(' ', ' · ')

type Svg = { alt: string; width: number; source: string; isInteractive: boolean }

type Seen = {
  texts: readonly string[]
  cardTexts: readonly string[]
  buttons: readonly { key: string; label: string; hotkey: string; prop: unknown }[]
  svgs: readonly Svg[]
  allSvgs: readonly Svg[]
}

const svgOf = (node: Drawn): Svg => ({
  alt: String(node.props?.alt ?? ''),
  width: Number(node.props?.width ?? 0),
  source: String(node.props?.source ?? ''),
  isInteractive: node.props?.isInteractive === true,
})

function seenOf(tree: unknown): Seen {
  const placed = placedOf(tree)
  const shown = placed.filter(one => !one.isInCard).map(one => one.node)
  return {
    texts: shown.filter(node => node.type === 'Text').map(textOf),
    cardTexts: placed.filter(one => one.isInCard && one.node.type === 'Text').map(one => textOf(one.node)),
    buttons: shown
      .filter(node => node.type === 'Button')
      .map(node => ({ key: keyOf(node), label: buttonLabel(node), hotkey: String(node.props?.hotkey ?? ''), prop: node.props?.label })),
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

const nodesOf = (value: unknown): Drawn[] =>
  Array.isArray(value) ? value.flatMap(nodesOf) : isDrawn(value) ? [value, ...(value.children ?? []).flatMap(nodesOf)] : []

const byKey = (tree: unknown, key: string) => nodesOf(tree).find(node => keyOf(node) === key)

const childrenOf = (node: Drawn | undefined) => (node?.children ?? []).filter(isDrawn)

const scopeOf = (node: Drawn) => node.hover?.scope

const slotsOf = (tree: unknown) =>
  nodesOf(tree).filter(node => node.type === 'Box' && node.props?.position === 'absolute' && nodesOf(node.children).some(isCard))

const triggerHolding = (tree: unknown, holds: (node: Drawn) => boolean) =>
  nodesOf(tree).find(node => node.type === 'Box' && !isCard(node) && scopeOf(node) !== undefined && nodesOf(node.children).some(holds))

const cardTextsOf = (tree: unknown, scope: string | undefined) =>
  nodesOf(tree)
    .filter(node => isCard(node) && scopeOf(node) === scope)
    .flatMap(card => nodesOf(card.children).filter(node => node.type === 'Text').map(textOf))

const railOf = (tree: unknown) => byKey(tree, 'pane-rail')

const railNames = (tree: unknown) => nodesOf(railOf(tree)).filter(node => node.type === 'Text').map(textOf)

const railMarks = (tree: unknown) =>
  childrenOf(railOf(tree))
    .filter(child => child.props?.flexGrow !== 1)
    .flatMap(child => childrenOf(child).filter(node => node.type === 'Svg'))

const railLinks = (tree: unknown) => childrenOf(railOf(tree)).filter(child => child.props?.flexGrow === 1)

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
  expect(railOf(tree)?.props?.flexDirection).toBe('row')
  const now = nodesOf(railOf(tree)).find(node => node.type === 'Text' && node.props?.weight === 'semibold')
  expect(textOf(now ?? {})).toBe('Review')
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

  const tree = await drawnAt($, 36)
  const seen = seenOf(tree)
  expect(seen.texts).toContain('~$0.00')
  expect(seen.texts).toContain(FIRE_TIME)
  expect(seen.texts).toContain(FIRE_SLUG)
  expect(railNames(tree)).toEqual(['Review'])
  expect(railMarks(tree).map(mark => String(mark.props?.alt))).toEqual([
    'Spec: done',
    'Build: done',
    'Review: now',
    'Fix: to come',
    'Ship: to come',
    'Integrate: to come',
    'Clean-up: to come',
  ])
})

test('the desktop rail is built from Boxes and names every stage at 60 columns', async ($, on) => {
  await fixRun($, on)

  for (const columns of [60, 40]) {
    const tree = await drawnAt($, columns)
    const rail = railOf(tree)
    expect(rail?.type).toBe('Box')
    expect(rail?.props?.flexDirection).toBe('row')
    const marks = railMarks(tree)
    expect(marks.length).toBe(7)
    for (const mark of marks) expect(typeof mark.props?.width).toBe('number')
    const links = railLinks(tree)
    expect(links.length).toBe(6)
    for (const link of links) expect(link.type).toBe('Box')
    expect(nodesOf(rail).some(node => node.type === 'Svg' && String(node.props?.alt).startsWith('Stage '))).toBe(false)
    if (columns === 60) expect(railNames(tree)).toEqual(['Spec', 'Build', 'Review', 'Fix', 'Ship', 'Integrate', 'Clean-up'])
    else expect(railNames(tree)).toEqual(['Fix'])
  }
})

test('a fully built MSP lanes bar is its done Box alone', async ($, on) => {
  await fixRun($, on)

  const tree = await drawnAt($, 100)
  const rows = nodesOf(tree).filter(node => node.type === 'Box' && keyOf(node).startsWith('msp-row-'))
  expect(rows.length).toBe(3)
  const bars = rows.map(row => {
    const label = keyOf(row).slice('msp-row-'.length)
    const parts = childrenOf(byKey(row, `msp-bar-${label}`))
    return { label, parts: parts.map(part => ({ key: keyOf(part), width: part.props?.width, flexGrow: part.props?.flexGrow })) }
  })
  expect(bars).toEqual([
    { label: 'limiter-core', parts: [{ key: 'msp-bar-done-limiter-core', width: 0, flexGrow: 1 }] },
    { label: 'redis-store', parts: [{ key: 'msp-bar-done-redis-store', width: 0, flexGrow: 1 }] },
    { label: 'headers-docs', parts: [{ key: 'msp-bar-done-headers-docs', width: 0, flexGrow: 1 }] },
  ])
  for (const svg of nodesOf(tree).filter(node => node.type === 'Svg')) expect(String(svg.props?.source)).not.toContain('width="100%"')
})

test('each rail connector names the two stages it joins', async ($, on) => {
  await fixRun($, on)

  for (const columns of [60, 40]) {
    const links = railLinks(await drawnAt($, columns))
    expect(links.map(link => keyOf(link))).toEqual(['rail-link-0', 'rail-link-1', 'rail-link-2', 'rail-link-3', 'rail-link-4', 'rail-link-5'])
    for (const link of links) expect(childrenOf(link).filter(node => node.type === 'Svg').length).toBe(1)
    expect(links.flatMap(link => childrenOf(link).map(node => node.props?.alt))).toEqual([
      'Spec to Build',
      'Build to Review',
      'Review to Fix',
      'Fix to Ship',
      'Ship to Integrate',
      'Integrate to Clean-up',
    ])
  }
})

test('a lanes remainder is drawn only while lanes are left to build', async ($, on) => {
  const world = harness(on, build, { now: NOW })
  await world.start($)

  const building = await drawnAt($, 100)
  const limiter = byKey(building, 'msp-bar-limiter-core')
  expect(childrenOf(limiter).map(keyOf)).toEqual(['msp-bar-done-limiter-core', 'msp-bar-rest-limiter-core'])
  expect(childrenOf(byKey(limiter, 'msp-bar-rest-limiter-core')).find(node => node.type === 'Svg')?.props?.alt).toBe('limiter-core: lanes still to build')

  world.use(fix)
  await world.clock.advance(2000)
  const fixing = await drawnAt($, 100)
  for (const label of ['limiter-core', 'redis-store', 'headers-docs']) {
    expect(childrenOf(byKey(fixing, `msp-bar-${label}`)).map(keyOf)).toEqual([`msp-bar-done-${label}`])
    expect(byKey(fixing, `msp-bar-rest-${label}`)).toBeUndefined()
  }
})

test('no desktop pane width, drawing or label follows bodyColumns', async ($, on) => {
  await fireRun($, on)

  const layoutOf = (tree: unknown) => {
    const labelled = [
      ...nodesOf(tree).filter(node => node.type === 'Button' && keyOf(node).startsWith('msp-')),
      ...nodesOf(byKey(tree, 'pane-thread')).slice(0, 1),
    ]
    return {
      sizes: nodesOf(tree)
        .filter(node => node.type === 'Box' || node.type === 'Svg')
        .map(node => ({ type: node.type, width: node.props?.width, source: node.type === 'Svg' ? node.props?.source : undefined })),
      words: labelled.flatMap(node => nodesOf(node.children).filter(one => one.type === 'Text').map(textOf)),
    }
  }
  const narrow = await drawnAt($, 60)
  const wide = await drawnAt($, 120)
  expect(layoutOf(wide)).toEqual(layoutOf(narrow))
  expect(layoutOf(narrow).words).toContain(FIRE_SLUG)
  const wordsBoxes = nodesOf(narrow).filter(node => node.type === 'Box' && /^worker-.+-\d+-words$/.test(keyOf(node)))
  expect(wordsBoxes.length).toBeGreaterThan(0)
  for (const box of wordsBoxes) {
    expect(box.props?.flexGrow).toBe(1)
    expect(box.props?.minWidth).toBe(0)
  }
})

test('the desktop pane reveals its cards in one slot and draws no SVG tooltips', async ($, on) => {
  await fireRun($, on)

  const tree = await drawnAt($, 100)
  const slots = slotsOf(tree)
  expect(slots.length).toBe(1)
  const cards = nodesOf(tree).filter(isCard)
  expect(cards.length).toBeGreaterThan(0)
  expect(nodesOf(slots[0]?.children).filter(isCard).length).toBe(cards.length)
  const texts = seenOf(tree).cardTexts
  expect(texts).not.toContain(COST_HINT)
  expect(texts).not.toContain(TIME_HINT)
  expect(cards.some(card => nodesOf(card.children).some(node => node.type === 'Text' && textOf(node) === 'mac-video-audio-and-recorder-ui'))).toBe(true)
  const scopes = new Set(cards.map(scopeOf))
  for (const scope of scopes) {
    expect(nodesOf(tree).some(node => node.type === 'Box' && !isCard(node) && scopeOf(node) === scope)).toBe(true)
  }
  for (const key of ['tile-cost', 'tile-agents', 'tile-time', 'pane-rail']) {
    expect(nodesOf(byKey(tree, key)).some(node => scopeOf(node) !== undefined)).toBe(false)
  }
  const svgs = nodesOf(tree).filter(node => node.type === 'Svg')
  expect(svgs.some(svg => svg.props?.isInteractive === true)).toBe(false)
  for (const svg of svgs) expect(String(svg.props?.source)).not.toContain('<title>')
})

test('marks and the slug carry hover cards and the tiles carry none', async ($, on) => {
  answerContext(on, 400_000)
  const world = harness(on, review, { now: NOW })
  world.queueSpawn({ agentId: 'a1', model: 'claude-opus-5-5' })
  await world.start($)
  await skill($, 'interphase:feature', 'Add rate limits. Interview me first.')
  await spawn($, 'code-reviewer', 'review limiter-core')
  await agentStep($, 'a1')

  const tree = await drawnAt($, 100)
  const seen = seenOf(tree)
  const proof = seen.allSvgs.find(svg => svg.alt.startsWith('Proof: '))
  expect(proof?.isInteractive).toBe(false)
  expect(proof?.source).toContain('>proof</text>')
  expect(cardTextsOf(tree, scopeOf(triggerHolding(tree, node => String(node.props?.alt).startsWith('Proof: ')) ?? {}))).toContain(PROOF_HINT)
  expect(cardTextsOf(tree, scopeOf(triggerHolding(tree, node => node.props?.alt === 'limiter-core crab') ?? {}))).toContain('mitosis/limiter-core')
  expect(cardTextsOf(tree, scopeOf(triggerHolding(tree, node => String(node.props?.alt).startsWith('Context ')) ?? {}))).toContain('Context 40%')
  expect(cardTextsOf(tree, scopeOf(triggerHolding(tree, node => node.type === 'Text' && textOf(node) === 'rate-limit-api') ?? {}))).toEqual(['rate-limit-api'])
  expect(seen.cardTexts).not.toContain(COST_HINT)
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
  expect(seen.svgs.some(svg => svg.alt === 'Full lane')).toBe(true)
  expect(railNames(tree)).toContain('Fix')
  expect(railMarks(tree).find(mark => mark.props?.alt === 'Fix: now')).toBeDefined()
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

  const proof = seenOf(await drawnAt($)).allSvgs.find(svg => svg.alt.startsWith('Proof: '))
  expect(proof?.source ?? '').toContain('fill="#D0453F"')
})

test('a finished Judge row says its blocker and advisory counts in words', async ($, on) => {
  await fireRun($, on)
  const pane = await mountPane($, 'desktop', 100)
  await press(pane, VIDEO)
  const tree = await pane.drawn()
  const judged = rowsOf(tree).find(row => row.seen.texts[0] === 'Judge' && roundIn(row) === 4)
  const verdict = judged?.seen.svgs.find(svg => svg.source.includes('data-pip'))
  const card = cardTextsOf(tree, scopeOf(triggerHolding(tree, node => node.type === 'Svg' && node.props?.alt === verdict?.alt && String(node.props?.source).includes('data-pip')) ?? {}))

  expect(verdict?.alt).toContain('1 blocker, 1 advisory')
  expect(card.some(line => line.includes('1 blocker, 1 advisory'))).toBe(true)
  expect(card).toContain('Red: blocker · yellow: advisory · grey: other candidate')
})

const MANY_FINDINGS = {
  outcome: 'loop',
  round: 4,
  blockers: [{ id: 'B1', severity: 'blocker', kind: 'take lost on sound failure', location: 'Sources/Recorder/Session.swift:40', summary: 'lost take' }],
  advisories: Array.from({ length: 20 }, (_, i) => ({
    id: `A${i + 2}`,
    severity: 'advisory',
    kind: `advisory kind ${i + 2}`,
    location: `Sources/Recorder/Session.swift:${50 + i}`,
    summary: 'an advisory',
  })),
  diagnose: [],
  blocked: [],
}

type Box = { x: number; y: number; w: number; h: number }

const boxesOf = (source: string, pattern: RegExp): Box[] =>
  [...source.matchAll(pattern)].map(match => {
    const tag = match[0]
    const number = (name: string) => Number(new RegExp(`\\s${name}="([-\\d.]+)"`).exec(tag)?.[1] ?? NaN)
    return { x: number('x'), y: number('y'), w: number('width'), h: number('height') }
  })

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

test('a verdict never draws its squares under its chip', async ($, on) => {
  const world = harness(on, withFile(fireplace, `${FH}/review/round-4/${VIDEO}.verdict.json`, MANY_FINDINGS, NOW - 60 * MIN), { now: NOW })
  world.queueSpawn({ agentId: 'a-judge', model: 'claude-sonnet-5-5' })
  await world.start($)
  await spawn($, 'validator', `validate ${VIDEO}`)

  for (const columns of [24, 30, 36, 46, 60, 100]) {
    const pane = await mountPane($, 'desktop', columns)
    if (columns === 24) await press(pane, VIDEO)
    const pictures = seenOf(await pane.drawn()).allSvgs.filter(svg => svg.source.includes('data-pip'))
    expect(pictures.length).toBeGreaterThan(0)
    for (const picture of pictures) {
      const height = Number(/height="([\d.]+)"/.exec(picture.source)?.[1] ?? NaN)
      const pips = boxesOf(picture.source, /<rect data-pip[^>]*>/g)
      const [chip] = boxesOf(picture.source, /<rect(?! data-pip)[^>]*rx="9"[^>]*>/g)
      expect(chip).toBeDefined()
      if (chip === undefined) continue
      expect(chip.x).toBeGreaterThanOrEqual(0)
      expect(chip.x + chip.w).toBeLessThanOrEqual(picture.width + 0.01)
      for (const pip of pips) {
        expect(pip.w).toBe(8)
        expect(overlaps(pip, chip)).toBe(false)
        expect(pip.x + pip.w).toBeLessThanOrEqual(picture.width + 0.01)
        expect(pip.y + pip.h).toBeLessThanOrEqual(height + 0.01)
      }
    }
    await pane.unmount()
  }
})

test('MSP marks and proof dots name what they show', async ($, on) => {
  const world = harness(on, review, { now: NOW })
  await world.start($)

  const alts = seenOf(await drawnAt($, 100)).allSvgs.map(svg => svg.alt)
  for (const label of ['limiter-core', 'redis-store', 'headers-docs']) expect(alts.some(alt => alt.startsWith(`${label}: `))).toBe(true)
  expect(alts.some(alt => alt === 'Proof: failed without the work, passed with it')).toBe(true)
  expect(alts.some(alt => alt.includes('●') || alt.includes('○'))).toBe(false)
})

test('pressing a second MSP moves the selection to it', async ($, on) => {
  await fireRun($, on)

  const pane = await mountPane($, 'desktop', 100)
  await press(pane, VIDEO)
  await press(pane, 'button-consistency')
  const tree = await pane.drawn()

  expect(seenOf(tree).texts).toContain('button-consistency · workers')
  expect(rowsOf(tree).some(row => row.key.includes(VIDEO))).toBe(false)
  const selectedAvatars = seenOf(tree).allSvgs.filter(svg => svg.source.includes('data-selected')).map(svg => svg.alt)
  expect(selectedAvatars).toEqual(['button-consistency crab'])
  await pane.press({ key: 'show-all' })
  expect(seenOf(await pane.drawn()).texts).toContain('Working now')
})

test('MSP buttons draw their words as text and carry no label', async ($, on) => {
  await fireRun($, on)

  for (const columns of [36, 46, 100]) {
    const pane = await mountPane($, 'desktop', columns)
    const buttons = seenOf(await pane.drawn()).buttons
    for (const button of mspButtons({ buttons } as Seen)) expect(String(button.prop)).toMatch(/^\d /)
    const names = mspButtons({ buttons } as Seen).map(button => button.label.split(' · ')[0] ?? '')
    const labels = ['mic-recovery', VIDEO, 'hearing-and-ring', 'button-consistency']
    expect(names.length).toBe(labels.length)
    names.forEach((name, i) => expect((labels[i] ?? '').startsWith(name.replace(/…$/, ''))).toBe(true))
    if (columns === 100) expect(names).toEqual(labels)
    await pane.unmount()
  }
})

const allCards = (tree: unknown) => placedOf(tree).filter(one => isCard(one.node)).map(one => one.node)

test('every pane hover card is opaque', async ($, on) => {
  await fireRun($, on)

  const pane = await mountPane($, 'desktop', 46)
  await press(pane, VIDEO)
  const cards = allCards(await pane.drawn())
  expect(cards.length).toBeGreaterThan(0)
  for (const card of cards) {
    expect(card.props?.backgroundColor).toBe('#2a2a29')
    for (const line of (card.children ?? []).filter(isDrawn)) expect(line.props?.color).toBe('#ffffff')
  }
})

test('no pane hover card opens over a button', async ($, on) => {
  await fireRun($, on)

  for (const columns of [36, 46, 100]) {
    const pane = await mountPane($, 'desktop', columns)
    for (const selection of [null, VIDEO]) {
      if (selection !== null) await press(pane, selection)
      const tree = await pane.drawn()
      for (const key of ['pane-title', 'pane-tiles', 'pane-rail', 'pane-msps', 'pane-workers']) expect(allCards(byKey(tree, key))).toEqual([])
      const [slot] = slotsOf(tree)
      expect(slot?.props?.top).toBe(0)
      expect(slot?.props?.left).toBe(0)
      expect(nodesOf(slot).some(node => node.type === 'Button')).toBe(false)
      expect(allCards(slot).length).toBe(allCards(tree).length)
    }
    await pane.unmount()
  }
})

for (const [name, run] of [['fireplace', fireRun], ['fix', fixRun]] as const) {
  test(`the ${name} pane's connectors and lanes strips keep their thickness when their box is narrower than the drawing`, async ($, on) => {
    await run($, on)

    for (const width of [60, 100, 160]) {
      const tree = await drawnAt($, width)
      const strips = nodesOf(tree).filter(node => /^(rail-link-|msp-bar-(done|rest)-)/.test(keyOf(node)))
      const svgs = strips.flatMap(strip => childrenOf(strip).filter(child => child.type === 'Svg'))
      expect(strips.some(strip => keyOf(strip).startsWith('rail-link-'))).toBe(true)
      expect(strips.some(strip => keyOf(strip).startsWith('msp-bar-done-'))).toBe(true)
      expect(svgs.length).toBe(strips.length)
      for (const svg of svgs) {
        expect(String(svg.props?.source ?? '')).toContain('preserveAspectRatio="none"')
      }
    }
  })
}
