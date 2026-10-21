import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { H, NOW, R, build, committedMsp, endedLane, fireplace, fix, fixRound2, integrate, review, spec, stateWith, withFile } from './fixtures/runs'
import { harness } from './harness'

const FIRE_SLUG = 'mac-video-audio-and-recorder-ui'
const FIRE_TIME = '15h 00m'
const MIN = 60_000

const bandProps = (bodyColumns: number) =>
  ({ hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns, scroll: { offset: 0, bodyRows: 4 }, view: {} }) as const

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

const mountBand = ($: Engine, surface: 'desktop' | 'terminal', bodyColumns = 100) =>
  $.ui.mount({ plugin: 'spindle', surface, component: 'AbovePrompt', props: bandProps(bodyColumns) })

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

type Seen = {
  texts: readonly string[]
  cardTexts: readonly string[]
  buttons: readonly { key: string; drawn: string }[]
  labels: readonly unknown[]
  svgs: readonly { alt: string; width: number; source: string }[]
}

function seenOf(tree: unknown): Seen {
  const placed = placedOf(tree)
  const shown = placed.filter(one => !one.isInCard).map(one => one.node)
  return {
    texts: shown.filter(node => node.type === 'Text').map(textOf),
    cardTexts: placed.filter(one => one.isInCard && one.node.type === 'Text').map(one => textOf(one.node)),
    buttons: shown
      .filter(node => node.type === 'Button')
      .map(node => ({ key: String(node.props?.key ?? ''), drawn: String(node.props?.label ?? textOf(node)) })),
    labels: placed.filter(one => one.node.type === 'Button').map(one => one.node.props?.label),
    svgs: shown
      .filter(node => node.type === 'Svg')
      .map(node => ({ alt: String(node.props?.alt ?? ''), width: Number(node.props?.width ?? 0), source: String(node.props?.source ?? '') })),
  }
}

async function seenAt($: Engine, surface: 'desktop' | 'terminal', bodyColumns: number): Promise<Seen> {
  const band = await mountBand($, surface, bodyColumns)
  const seen = seenOf(await band.drawn())
  await band.unmount()
  return seen
}

const barOf = (seen: Seen) => seen.svgs.find(svg => svg.source.includes('data-part="bar"'))

const pillOf = (seen: Seen) => seen.svgs.find(svg => svg.source.includes('data-part="pill"'))

const hasChip = (seen: Seen, lane: string) => seen.svgs.some(svg => svg.alt === `${lane} lane`)

const crabOf = (seen: Seen) => seen.svgs.find(svg => svg.alt.endsWith(' crab'))

const hasButton = (seen: Seen, key: string) => seen.buttons.some(button => button.key === key)

const slugOf = (seen: Seen) => seen.buttons.find(button => button.key === 'spindle-slug')?.drawn

const emptyCardsOf = (tree: unknown) => placedOf(tree).filter(one => isCard(one.node) && (one.node.children ?? []).length === 0)

const COUNT_BUTTON = { key: 'spindle-crew' }

const DISMISS_BUTTON = { key: 'spindle-dismiss', drawn: '✕' }

const WIDTHS = Array.from({ length: 161 }, (_, i) => 40 + i)

const nodesOf = (value: unknown): Drawn[] =>
  Array.isArray(value) ? value.flatMap(nodesOf) : isDrawn(value) ? [value, ...(value.children ?? []).flatMap(nodesOf)] : []

const keyOf = (node: Drawn) => String(node.props?.key ?? '')

const byKey = (tree: unknown, key: string) => nodesOf(tree).find(node => keyOf(node) === key)

const childrenOf = (node: Drawn | undefined) => (node?.children ?? []).filter(isDrawn)

const scopeOf = (node: Drawn) => node.hover?.scope

const svgSource = (node: Drawn | undefined) => String(node?.props?.source ?? '')

const isTexture = (node: Drawn) => node.type === 'Svg' && svgSource(node).includes('data-part="bar"')

const isPill = (node: Drawn) => node.type === 'Svg' && svgSource(node).includes('data-part="pill"')

const slotsOf = (tree: unknown) =>
  nodesOf(tree).filter(node => node.type === 'Box' && node.props?.position === 'absolute' && nodesOf(node.children).some(isCard))

const triggersOf = (tree: unknown) => nodesOf(tree).filter(node => node.type === 'Box' && !isCard(node) && scopeOf(node) !== undefined)

const triggerHolding = (tree: unknown, holds: (node: Drawn) => boolean) => triggersOf(tree).find(trigger => nodesOf(trigger.children).some(holds))

const cardTextsOf = (tree: unknown, scope: string) =>
  nodesOf(tree)
    .filter(node => isCard(node) && scopeOf(node) === scope)
    .flatMap(card => nodesOf(card.children).filter(node => node.type === 'Text').map(textOf))

const PROGRESS_SCOPE_OF = (tree: unknown) => scopeOf(triggerHolding(tree, node => keyOf(node) === 'spindle-bar' || isPill(node)) ?? {}) ?? ''

async function drawnAt($: Engine, surface: 'desktop' | 'terminal', bodyColumns: number): Promise<unknown> {
  const band = await mountBand($, surface, bodyColumns)
  const tree = await band.drawn()
  await band.unmount()
  return tree
}

async function fireRun($: Engine, on: On, withValidator = false) {
  const world = harness(on, fireplace, { now: NOW })
  world.queueSpawn({ agentId: 'a-judge', model: 'claude-opus-5-5' })
  await world.start($)
  await skill($, 'interphase:feature', 'Record video like a camera. Interview me first.')
  if (withValidator) await spawn($, 'validator', 'validate round 4')
  return world
}

async function reviewRun($: Engine, on: On) {
  const world = harness(on, review, { now: NOW })
  world.queueSpawn({ agentId: 'a1', model: 'claude-opus-5-5' })
  await world.start($)
  await skill($, 'interphase:feature', 'Add rate limits. Interview me first.')
  await spawn($, 'code-reviewer', 'review limiter-core')
  return world
}

async function status($: Engine): Promise<string[]> {
  const answered = await $.command.run({ command: 'spindle', args: 'status' } as never)
  return String(answered.text ?? '').split('\n')
}

const showAnotherBand = (on: On) =>
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return Text({ children: 'another band' })
  })

async function isBandShown($: Engine): Promise<boolean> {
  const band = await mountBand($, 'desktop')
  const isShown = (await band.find({ key: 'spindle-dismiss' })) !== undefined
  await band.unmount()
  return isShown
}

test('the band at 160 columns shows every part', async ($, on) => {
  await fireRun($, on)

  const seen = await seenAt($, 'desktop', 160)

  expect(slugOf(seen)).toBe(FIRE_SLUG)
  expect(hasChip(seen, 'Full')).toBe(true)
  expect(barOf(seen)).toBeDefined()
  expect(pillOf(seen)?.source).toContain('>Review · R5</text>')
  expect(seen.texts).toContain(FIRE_TIME)
  expect(crabOf(seen)).toBeDefined()
  expect(hasButton(seen, 'spindle-crew')).toBe(true)
  expect(hasButton(seen, 'spindle-dismiss')).toBe(true)
})

test('the desktop slug truncates natively and the lane chip always shows', { timeoutMs: 60_000 }, async ($, on) => {
  await fireRun($, on)

  for (const width of WIDTHS) {
    const tree = await drawnAt($, 'desktop', width)
    const seen = seenOf(tree)
    expect(slugOf(seen)).toBe('mac-video-audio-and-recorder-ui')
    const room = nodesOf(tree).find(node => node.type === 'Box' && childrenOf(node).some(child => keyOf(child) === 'spindle-slug'))
    expect(room?.props?.flexShrink).toBe(1)
    expect(room?.props?.minWidth).toBe(0)
    const slugText = nodesOf(byKey(tree, 'spindle-slug')?.children).find(node => node.type === 'Text')
    expect(slugText?.props?.wrap).toBe('truncate-end')
    expect(textOf(slugText ?? {})).toBe('mac-video-audio-and-recorder-ui')
    expect(hasButton(seen, 'spindle-name')).toBe(false)
    expect(seen.svgs.some(svg => svg.alt === 'Full lane')).toBe(true)
  }
})

test('the terminal band follows the same rules', async ($, on) => {
  await fireRun($, on)

  const wideSeen = await seenAt($, 'terminal', 160)
  const narrowSeen = await seenAt($, 'terminal', 40)
  const wide = wideSeen.texts.find(text => text.startsWith('●')) ?? ''
  const narrow = narrowSeen.texts.join(' ')

  expect(wide).toContain(FIRE_SLUG)
  expect(wide).toContain('[Full]')
  expect(wide).toMatch(/[█░]/)
  expect(narrow.startsWith('●')).toBe(true)
  expect(hasButton(narrowSeen, 'spindle-name')).toBe(true)
  expect(narrow).toContain('Review · R5')
  expect(narrow).toContain(FIRE_TIME)
  expect(narrow).not.toContain(FIRE_SLUG)
  expect(narrow).not.toMatch(/[█░]/)
  expect(wide).not.toContain('…')
  expect(narrow).not.toContain('…')
})

test('the desktop bar fills the band through flex', async ($, on) => {
  await fireRun($, on)

  const textures: { source: string; width: unknown }[] = []
  for (const width of [100, 200]) {
    const tree = await drawnAt($, 'desktop', width)
    const bar = byKey(tree, 'spindle-bar')
    expect(bar?.type).toBe('Box')
    expect(bar?.props?.flexGrow).toBe(1)
    expect(bar?.props?.minWidth).toBe(0)
    expect(bar?.props?.overflow).toBe('hidden')
    const [track, ticks, filled, holder, remainder, ...extra] = childrenOf(bar)
    expect(extra).toEqual([])
    expect(keyOf(track ?? {})).toBe('spindle-track')
    expect(keyOf(ticks ?? {})).toBe('spindle-ticks')
    expect(ticks?.props?.position).toBe('absolute')
    expect(filled?.type).toBe('Box')
    expect(keyOf(filled ?? {})).toBe('spindle-bar-filled')
    expect(filled?.props?.width).toBe(0)
    expect(filled?.props?.overflow).toBe('hidden')
    expect(filled?.props?.position).toBe('relative')
    expect(Math.abs(Number(filled?.props?.flexGrow) - 2.9 / 7)).toBeLessThan(1e-9)
    expect(Math.abs(Number(filled?.props?.flexGrow) - 0.4143)).toBeLessThan(0.0001)
    expect(holder?.type).toBe('Box')
    expect(keyOf(holder ?? {})).toBe('spindle-pill-holder')
    expect(holder?.props?.flexShrink).toBe(0)
    const pill = childrenOf(holder).find(isPill)
    expect(svgSource(pill)).toContain('data-part="pill"')
    expect(svgSource(pill)).toContain('Review · R5')
    expect(remainder?.type).toBe('Box')
    expect(keyOf(remainder ?? {})).toBe('spindle-bar-rest')
    expect(remainder?.props?.width).toBe(0)
    expect(Math.abs(Number(remainder?.props?.flexGrow) - 4.1 / 7)).toBeLessThan(1e-9)
    expect(Math.abs(Number(remainder?.props?.flexGrow) - 0.5857)).toBeLessThan(0.0001)
    expect(nodesOf(filled?.children).filter(node => node.type === 'Box')).toEqual([])
    const [texture, ...beside] = childrenOf(filled)
    expect(beside).toEqual([])
    expect(texture?.type).toBe('Svg')
    expect(svgSource(texture)).toContain('data-part="bar"')
    textures.push({ source: svgSource(texture), width: texture?.props?.width })
    const [offset, ...marks] = childrenOf(ticks)
    expect(offset?.type).toBe('Box')
    expect(offset?.props?.flexShrink).toBe(0)
    const spacer = childrenOf(offset).find(child => child.type === 'Svg')
    expect(spacer?.props?.alt).toBe('space for the stage label')
    expect(spacer?.props?.width).toBe(pill?.props?.width)
    expect(marks.length).toBe(7)
    for (const mark of marks) {
      expect(mark.type).toBe('Box')
      expect(mark.props?.width).toBe(0)
      expect(mark.props?.flexGrow).toBe(1)
    }
    const pixelProps = nodesOf(bar?.children)
      .filter(node => node.type === 'Box')
      .flatMap(node => Object.entries(node.props ?? {}).filter(([, value]) => typeof value === 'string' && value.endsWith('px')))
    expect(pixelProps).toEqual([])
  }
  expect(textures[1]).toEqual(textures[0])
})

test('the desktop texture keeps its full height when its box is narrower than the drawing', async ($, on) => {
  await fireRun($, on)

  for (const width of [100, 160, 200]) {
    const tree = await drawnAt($, 'desktop', width)
    const texture = childrenOf(byKey(tree, 'spindle-bar-filled')).find(isTexture)
    expect(svgSource(texture)).toContain('preserveAspectRatio="xMinYMid slice"')
    expect(svgSource(texture)).toMatch(/<clipPath id="spindle-bar-start"><rect [^>]*rx="8"\/><\/clipPath>/)
    expect(svgSource(texture)).toContain('clip-path="url(#spindle-bar-start)"')
  }
})

test('the desktop bar draws a track with rounded ends behind the fill and the pill', async ($, on) => {
  await fireRun($, on)

  for (const width of [100, 160, 200]) {
    const tree = await drawnAt($, 'desktop', width)
    const bar = byKey(tree, 'spindle-bar')
    expect(bar?.props?.backgroundColor).toBeUndefined()
    const track = byKey(tree, 'spindle-track')
    expect(childrenOf(bar)[0]).toBe(track)
    expect(track?.props).toMatchObject({ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row' })
    const halves = childrenOf(track)
    expect(halves.map(keyOf)).toEqual(['spindle-track-start', 'spindle-track-end'])
    for (const half of halves) {
      expect(half.props).toMatchObject({ width: 0, flexGrow: 1, overflow: 'hidden' })
    }
    const [start, end] = halves.map(half => childrenOf(half).find(child => child.type === 'Svg'))
    expect(svgSource(start)).toContain('preserveAspectRatio="xMinYMid slice"')
    expect(svgSource(start)).toMatch(/<rect data-part="track" x="0" [^>]*rx="8"/)
    expect(svgSource(end)).toContain('preserveAspectRatio="xMaxYMid slice"')
    expect(svgSource(end)).toMatch(/<rect data-part="track" x="-16" [^>]*rx="8"/)
    expect(byKey(tree, 'spindle-bar-filled')?.props?.position).toBe('relative')
    expect(byKey(tree, 'spindle-pill-holder')?.props?.position).toBe('relative')
  }
})

test('below 60 columns the band shows the pill alone', async ($, on) => {
  await fireRun($, on)

  const narrow = await drawnAt($, 'desktop', 59)
  const pill = nodesOf(narrow).find(isPill)
  expect(pill?.props?.alt).toBe('mac-video-audio-and-recorder-ui: Review · R5')
  expect(byKey(narrow, 'spindle-bar')).toBeUndefined()
  expect(nodesOf(narrow).some(isTexture)).toBe(false)

  const wide = await drawnAt($, 'desktop', 60)
  expect(byKey(wide, 'spindle-bar')?.type).toBe('Box')
})

test('at Spec the filled part still holds the whole pill', async ($, on) => {
  const world = harness(on, spec, { now: NOW })
  await world.start($)

  const tree = await drawnAt($, 'desktop', 100)
  const parts = childrenOf(byKey(tree, 'spindle-bar'))
  const at = parts.findIndex(child => keyOf(child) === 'spindle-bar-filled')
  const filled = parts[at]
  expect(filled?.type).toBe('Box')
  expect(filled?.props?.width).toBe(0)
  expect(filled?.props?.flexGrow).toBe(0)
  const holder = parts[at + 1]
  expect(keyOf(holder ?? {})).toBe('spindle-pill-holder')
  expect(holder?.props?.flexShrink).toBe(0)
  const pill = childrenOf(holder).find(isPill)
  expect(svgSource(pill)).toContain('>Spec</text>')
  expect(pill?.props?.width).toBeGreaterThan(0)
  const offset = childrenOf(byKey(tree, 'spindle-ticks'))[0]
  const spacer = childrenOf(offset).find(child => child.type === 'Svg')
  expect(spacer?.props?.alt).toBe('space for the stage label')
  expect(spacer?.props?.width).toBe(pill?.props?.width)
})

function pathTo(from: Drawn | undefined, holds: (node: Drawn) => boolean, above: readonly Drawn[] = []): Drawn[] | null {
  if (from === undefined) return null
  if (holds(from)) return [...above]
  return childrenOf(from).reduce<Drawn[] | null>((found, child) => found ?? pathTo(child, holds, [...above, from]), null)
}

function absoluteBetween(bar: Drawn | undefined, holds: (node: Drawn) => boolean): string[] {
  const path = pathTo(bar, holds)
  return path === null
    ? ['not found']
    : path
        .slice(1)
        .filter(node => node.type === 'Box' && node.props?.position === 'absolute')
        .map(keyOf)
}

const tickAltsOf = (tree: unknown) =>
  childrenOf(byKey(tree, 'spindle-ticks'))
    .filter(child => keyOf(child).startsWith('spindle-tick-'))
    .flatMap(child => childrenOf(child).filter(node => node.type === 'Svg'))
    .map(svg => svg.props?.alt)

test('the desktop bar holds its height without the pill', async ($, on) => {
  const world = harness(on, fireplace, { now: NOW })
  await world.start($)

  const expectHeldBar = (tree: unknown, share: number) => {
    const bar = byKey(tree, 'spindle-bar')
    const filled = byKey(bar, 'spindle-bar-filled')
    expect(filled?.type).toBe('Box')
    expect(filled?.props?.width).toBe(0)
    expect(Math.abs(Number(filled?.props?.flexGrow) - share)).toBeLessThan(1e-9)
    expect(filled?.props?.overflow).toBe('hidden')
    expect(filled?.props?.position).not.toBe('absolute')
    const texture = nodesOf(bar).find(isTexture)
    expect(texture?.props?.height).toBe(16)
    expect(absoluteBetween(bar, isTexture)).toEqual([])
    const pill = nodesOf(byKey(bar, 'spindle-pill-holder')).find(isPill)
    expect(pill?.props?.height).toBe(16)
    expect(absoluteBetween(bar, isPill)).toEqual([])
    const pixelProps = nodesOf(bar)
      .filter(node => node.type === 'Box')
      .flatMap(node => Object.entries(node.props ?? {}).filter(([, value]) => typeof value === 'string' && value.endsWith('px')))
    expect(pixelProps).toEqual([])
  }

  expectHeldBar(await drawnAt($, 'desktop', 100), 2.9 / 7)

  world.use(spec)
  await world.clock.advance(2000)
  expectHeldBar(await drawnAt($, 'desktop', 100), 0)
})

test('each desktop band Svg says what it shows', async ($, on) => {
  const world = harness(on, fireplace, { now: NOW })
  await world.start($)

  const tree = await drawnAt($, 'desktop', 100)
  const bar = byKey(tree, 'spindle-bar')
  expect(nodesOf(byKey(bar, 'spindle-pill-holder')).find(isPill)?.props?.alt).toBe('mac-video-audio-and-recorder-ui: Review · R5')
  expect(nodesOf(bar).find(isTexture)?.props?.alt).toBe('41% of the run done')
  expect(nodesOf(byKey(bar, 'spindle-ticks-offset')).find(node => node.type === 'Svg')?.props?.alt).toBe('space for the stage label')
  expect(tickAltsOf(tree)).toEqual(['start of Fix', 'start of Ship', 'start of Integrate', 'start of Clean-up'])
})

test("at Spec the band's ticks and texture say what they show", async ($, on) => {
  const world = harness(on, spec, { now: NOW })
  await world.start($)

  const tree = await drawnAt($, 'desktop', 100)
  const bar = byKey(tree, 'spindle-bar')
  expect(nodesOf(bar).find(isTexture)?.props?.alt).toBe('0% of the run done')
  expect(tickAltsOf(tree)).toEqual([
    'start of Build',
    'start of Review',
    'start of Fix',
    'start of Ship',
    'start of Integrate',
    'start of Clean-up',
  ])
  expect(String(nodesOf(byKey(bar, 'spindle-pill-holder')).find(isPill)?.props?.alt)).toMatch(/: Spec$/)
})

test('no desktop band width or drawing follows bodyColumns', async ($, on) => {
  await fireRun($, on)

  const layoutOf = (tree: unknown) =>
    nodesOf(tree).map(node => ({
      type: node.type,
      width: node.props?.width,
      minWidth: node.props?.minWidth,
      flexGrow: node.props?.flexGrow,
      height: node.props?.height,
      source: node.type === 'Svg' ? svgSource(node) : undefined,
      alt: node.props?.alt,
    }))
  const at60 = layoutOf(await drawnAt($, 'desktop', 60))
  expect(layoutOf(await drawnAt($, 'desktop', 100))).toEqual(at60)
  expect(layoutOf(await drawnAt($, 'desktop', 200))).toEqual(at60)
})

test('the desktop band reveals its cards in one slot', async ($, on) => {
  await fireRun($, on, true)

  const tree = await drawnAt($, 'desktop', 160)
  const slots = slotsOf(tree)
  expect(slots.length).toBe(1)
  const cards = nodesOf(tree).filter(isCard)
  expect(nodesOf(slots[0]?.children).filter(isCard).length).toBe(cards.length)
  expect(cards.length).toBe(3)
  const progress = scopeOf(triggerHolding(tree, node => keyOf(node) === 'spindle-bar') ?? {})
  const stage = scopeOf(triggerHolding(tree, node => node.type === 'Svg' && String(node.props?.alt).startsWith('Stage ')) ?? {})
  const lane = scopeOf(triggerHolding(tree, node => node.type === 'Svg' && node.props?.alt === 'Full lane') ?? {})
  expect([progress, stage, lane].every(scope => scope !== undefined)).toBe(true)
  expect(cards.map(card => card.hover?.display)).toEqual(['flex', 'flex', 'flex'])
  expect(cards.map(scopeOf).sort()).toEqual([progress, stage, lane].sort())
  const texts = seenOf(tree).cardTexts
  expect(texts).toContain('Full lane: interview, spec, build, review until green')
  expect(cardTextsOf(tree, lane ?? '')).toEqual(['Full lane: interview, spec, build, review until green'])
  for (const text of ['Time since the run started', 'Hide until an MSP moves to a new activity', 'Press to copy the name']) {
    expect(texts).not.toContain(text)
  }
  for (const svg of nodesOf(tree).filter(node => node.type === 'Svg')) expect(svgSource(svg)).not.toContain('<title>')
})

test('copying the slug toasts the copy result', async ($, on) => {
  const world = await fireRun($, on, true)

  const band = await mountBand($, 'desktop', 160)
  const before = seenOf(await band.drawn())
  await band.press({ key: 'spindle-slug' })
  expect(world.copies()).toEqual(['mac-video-audio-and-recorder-ui'])
  expect(world.toasts()).toContain('Copied mac-video-audio-and-recorder-ui')
  const after = seenOf(await band.drawn())
  expect(after.cardTexts).toEqual(before.cardTexts)
  expect(after.texts).toEqual(before.texts)

  world.answerCopy({ isCopied: false, reason: 'no-clipboard' })
  const earlier = world.toasts().length
  await band.press({ key: 'spindle-slug' })
  const added = world.toasts().slice(earlier)
  expect(added).toContain("Couldn't copy the name here")
  expect(added.some(toast => toast.startsWith('Copied'))).toBe(false)
  expect(seenOf(await band.drawn()).cardTexts).toEqual(before.cardTexts)
})

test("the fireplace run's pill reads Review R5", async ($, on) => {
  const world = harness(on, fireplace, { now: NOW })
  await world.start($)

  const tree = await drawnAt($, 'desktop', 160)
  expect(pillOf(seenOf(tree))?.alt).toBe('mac-video-audio-and-recorder-ui: Review · R5')
  expect(barOf(seenOf(tree))?.alt).toBe('41% of the run done')
  const card = cardTextsOf(tree, PROGRESS_SCOPE_OF(tree))
  expect(card).toEqual([
    'mic-recovery: Ship · pull request #329',
    'video-starts-like-a-camera: Round 5 · suite running · 7m',
    'hearing-and-ring: Ship · waiting for pull request',
    'button-consistency: Round 4 · diagnosing · 10m',
  ])
})

test('integrate fills the bar', async ($, on) => {
  const everyPull = withFile(
    integrate,
    `${R}/state.json`,
    stateWith(
      {
        '0': endedLane(0, 0, 'ok', 4),
        '1': endedLane(1, 0, 'ok', 3),
        '2': endedLane(2, 1, 'ok', 3),
        '3': endedLane(3, 2, 'ok', 3),
      },
      {
        '0': committedMsp('limiter-core', '#41', '4b825dc642cb6eb9a060e54bf8d69288fbee4904', true),
        '1': committedMsp('redis-store', '#42', '9f2c1e0b7d4a6e3f8c5b2a1d0e9f8c7b6a5d4e3f', false),
        '2': committedMsp('headers-docs', '#43', '1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d', false),
      },
    ),
    NOW - 10_000,
  )
  const world = harness(on, everyPull, { now: NOW })
  await world.start($)

  const tree = await drawnAt($, 'desktop', 160)
  const pill = nodesOf(byKey(tree, 'spindle-bar')?.children).find(isPill)
  expect(pill?.props?.alt).toBe('rate-limit-api: Integrate')
})

test('the count button opens the pane', async ($, on) => {
  const world = await fireRun($, on, true)

  const band = await mountBand($, 'desktop', 160)
  const count = seenOf(await band.find({ key: 'spindle-crew' }))
  expect(crabOf(count)).toBeUndefined()
  expect(count.buttons).toEqual([{ ...COUNT_BUTTON, drawn: '×1' }])
  expect(count.labels).toEqual(['×1'])
  await band.press({ key: 'spindle-crew' })

  expect(world.opened()).toContain('spindle-run')
})

const pressX = async (band: Awaited<ReturnType<typeof mountBand>>) => {
  expect(seenOf(await band.find({ key: 'spindle-dismiss' })).buttons).toEqual([DISMISS_BUTTON])
  await band.press({ key: 'spindle-dismiss' })
}

test('dismiss holds until an activity changes', { timeoutMs: 60_000 }, async ($, on) => {
  showAnotherBand(on)
  const world = harness(on, review, { now: NOW })
  await world.start($)

  const band = await mountBand($, 'desktop')
  await pressX(band)
  expect(await band.drawn()).toMatchObject({ type: 'Text', children: ['another band'] })
  expect(await isBandShown($)).toBe(false)

  await world.clock.advance(5 * MIN)
  expect(await isBandShown($)).toBe(false)

  world.use(fix)
  await world.clock.advance(2000)
  expect((await status($)).some(line => line.startsWith('msp limiter-core now Fix after round 1'))).toBe(true)
  expect(await isBandShown($)).toBe(true)
})

test('a round state change shows the band again', async ($, on) => {
  showAnotherBand(on)
  const world = harness(on, fixRound2, { now: NOW })
  await world.start($)
  expect((await status($)).some(line => line.startsWith('msp limiter-core now Round 2 · suite running'))).toBe(true)

  const band = await mountBand($, 'desktop')
  await pressX(band)
  expect(await isBandShown($)).toBe(false)

  world.use(withFile(fixRound2, `${H}/review/round-2/limiter-core.suite.txt`, 'all tests passed\n', NOW - 20_000))
  await world.clock.advance(2000)
  expect((await status($)).some(line => line.startsWith('msp limiter-core now Round 2 · reviewing'))).toBe(true)
  expect(await isBandShown($)).toBe(true)
})

test('desktop band shows slug, lane and Review R1', async ($, on) => {
  await reviewRun($, on)

  const seen = await seenAt($, 'desktop', 100)
  expect(slugOf(seen)).toBe('rate-limit-api')
  expect(hasChip(seen, 'Full')).toBe(true)
  const pill = seen.svgs.find(svg => svg.alt === 'rate-limit-api: Review · R1')
  expect(pill?.source).toContain('data-part="pill"')
  expect(pill?.source).toContain('>Review · R1</text>')
  expect(barOf(seen)?.source).toContain('data-part="bar"')
  expect(crabOf(seen)?.source).toContain('c-detective')
})

test('terminal band is text', async ($, on) => {
  await reviewRun($, on)

  const band = await mountBand($, 'terminal')
  const row = await band.find({ type: 'Text', text: /● rate-limit-api/ })
  expect(row?.text).toContain('● rate-limit-api')
  expect(row?.text).toContain('[Full]')
  expect(row?.text).toContain('Review · R1')
  expect((await band.findAll({ type: 'Svg' })).length).toBe(0)
})

test('crew button opens the pane', async ($, on) => {
  const world = await reviewRun($, on)

  const band = await mountBand($, 'desktop')
  expect(seenOf(await band.find({ key: 'spindle-crew' })).buttons).toEqual([{ ...COUNT_BUTTON, drawn: '×1' }])
  await band.press({ key: 'spindle-crew' })

  expect(world.opened()).toContain('spindle-run')
})

async function desktopSources($: Engine): Promise<string> {
  const seen = await seenAt($, 'desktop', 100)
  return seen.svgs.map(svg => svg.source).join('\n')
}

test('every costume draws with clay and reduced motion', async ($, on) => {
  on('tool.call', { tool: 'mcp__github__create_pull_request' }, async () => {
    await world.clock.sleep(5000)
    return { result: { html_url: 'https://github.com/SatanshuMishra/api/pull/41' } } as never
  })
  const world = harness(on, spec, { now: NOW })
  world.queueSpawn({ agentId: 'a-scout', model: 'claude-opus-5-5' })
  world.queueSpawn({ agentId: 'a-review', model: 'claude-opus-5-5' })
  world.queueSpawn({ agentId: 'a-judge', model: 'claude-opus-5-5' })
  await world.start($)

  const captain = await desktopSources($)

  world.use(build)
  await world.clock.advance(2000)
  const builder = await desktopSources($)

  await spawn($, 'interphase:scout', 'find the limiter docs')
  const scribe = await desktopSources($)

  await spawn($, 'code-reviewer', 'review limiter-core')
  const detective = await desktopSources($)

  await spawn($, 'validator', 'validate round 1')
  const judge = await desktopSources($)

  const opening = $.tool.call({ tool: 'mcp__github__create_pull_request', head: 'mitosis/limiter-core', base: 'main', title: 'feat: add the limiter', body: '' } as never)
  await world.clock.settle()
  const courier = await desktopSources($)
  await world.clock.advance(5000)
  await opening

  const seen = { captain, scribe, builder, detective, judge, courier }
  for (const [role, source] of Object.entries(seen)) {
    expect(source).toContain('fill="#D97757"')
    expect(source).toContain(`class="c-${role}`)
    expect(source).toContain('prefers-reduced-motion')
  }
})

test('the dismiss button is the X glyph on both surfaces', async ($, on) => {
  const world = harness(on, review, { now: NOW })
  await world.start($)

  const desktop = await mountBand($, 'desktop')
  expect(seenOf(await desktop.find({ key: 'spindle-dismiss' })).buttons).toEqual([DISMISS_BUTTON])
  expect((await desktop.find({ key: 'spindle-dismiss' }))?.props.role).toBe('dismiss')
  const terminal = await mountBand($, 'terminal')
  expect(seenOf(await terminal.find({ key: 'spindle-dismiss' })).buttons).toEqual([DISMISS_BUTTON])
})

test('no band Button draws words in place of its glyph', async ($, on) => {
  await fireRun($, on, true)

  for (const width of [40, 60, 160]) {
    for (const surface of ['desktop', 'terminal'] as const) {
      const seen = await seenAt($, surface, width)
      expect(seen.labels.length).toBeGreaterThan(0)
      for (const label of seen.labels) expect([...String(label)].length <= 2 || label === FIRE_SLUG).toBe(true)
    }
  }
  for (const width of [40, 60, 160]) {
    const desktop = await seenAt($, 'desktop', width)
    expect(hasButton(desktop, 'spindle-name')).toBe(false)
    expect(desktop.cardTexts).not.toContain('Press to copy the name')
  }
  const terminal = await seenAt($, 'terminal', 40)
  expect(terminal.buttons.find(button => button.key === 'spindle-name')?.drawn).toBe('◉')
  expect(terminal.cardTexts).toContain('Press to copy the name')
})

const allCards = (tree: unknown) => placedOf(tree).filter(one => isCard(one.node)).map(one => one.node)

test('every band hover card is opaque and wide enough for its words', async ($, on) => {
  await fireRun($, on, true)

  for (const surface of ['desktop', 'terminal'] as const) {
    const cards = allCards(await drawnAt($, surface, 160))
    expect(cards.length).toBeGreaterThan(0)
    for (const card of cards) {
      expect(card.props?.backgroundColor).toBe('#2a2a29')
      const lines = (card.children ?? []).filter(isDrawn)
      for (const line of lines) expect(line.props?.color).toBe('#ffffff')
      const longest = Math.max(...lines.map(line => [...textOf(line)].length))
      if (surface === 'desktop') expect(card.props?.width).toBeUndefined()
      else expect(Number(card.props?.width)).toBeGreaterThan(longest)
    }
  }
})

test('a hover card with nothing to say is not drawn', async ($, on) => {
  const world = harness(on, spec, { now: NOW })
  await world.start($)

  for (const surface of ['desktop', 'terminal'] as const) {
    const band = await mountBand($, surface, 160)
    const drawn = await band.drawn()
    expect(hasButton(seenOf(drawn), 'spindle-dismiss')).toBe(true)
    expect(emptyCardsOf(drawn)).toEqual([])
    await band.unmount()
  }
})

test('the crab carries no hover card', async ($, on) => {
  await fireRun($, on, true)

  const desktop = await drawnAt($, 'desktop', 160)
  const crab = placedOf(desktop).find(one => one.node.type === 'Svg' && String(one.node.props?.alt).endsWith(' crab'))
  expect(crab?.isInCard).toBe(false)
  expect(triggerHolding(desktop, node => node === crab?.node)).toBeUndefined()
  const terminal = await mountBand($, 'terminal', 160)
  expect(seenOf(await terminal.find({ key: 'spindle-crew-card' })).svgs).toEqual([])
  await terminal.unmount()
})
