import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { H, NOW, R, build, committedMsp, endedLane, fireplace, fix, fixRound2, integrate, review, spec, stateWith, withFile } from './fixtures/runs'
import { harness } from './harness'

const FIRE_SLUG = 'mac-video-audio-and-recorder-ui'
const FIRE_TIME = '15h 00m'
const REVIEW_PILL_W = 88
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

type Seen = {
  texts: readonly string[]
  cardTexts: readonly string[]
  buttons: readonly { key: string; drawn: string; name: string }[]
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
      .map(node => ({ key: String(node.props?.key ?? ''), drawn: textOf(node), name: String(node.props?.label ?? '') })),
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

const barOf = (seen: Seen) => seen.svgs.find(svg => svg.alt.startsWith(`${FIRE_SLUG}: `))

const crabOf = (seen: Seen) => seen.svgs.find(svg => svg.alt.endsWith(' crab'))

const hasButton = (seen: Seen, key: string) => seen.buttons.some(button => button.key === key)

const columnsDrawn = (seen: Seen) => {
  const parts = [
    ...seen.texts.map(text => [...text].length),
    ...seen.buttons.map(button => [...button.drawn].length),
    ...seen.svgs.map(svg => Math.ceil(svg.width / 8)),
  ]
  return parts.reduce((sum, part) => sum + part, 0) + parts.length - 1
}

const emptyCardsOf = (tree: unknown) => placedOf(tree).filter(one => isCard(one.node) && (one.node.children ?? []).length === 0)

const COUNT_BUTTON = { key: 'spindle-crew', name: 'Show the Pipeline pane' }

const DISMISS_BUTTON = { key: 'spindle-dismiss', drawn: '✕', name: 'Hide the band' }

const isUnbrokenUpTo = (widths: readonly number[], last: number) =>
  widths.length > 0 && widths[widths.length - 1] === last && widths.every((width, i) => i === 0 || width === (widths[i - 1] ?? 0) + 1)

const WIDTHS = Array.from({ length: 121 }, (_, i) => 40 + i)

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

  expect(seen.texts).toContain(FIRE_SLUG)
  expect(seen.texts).toContain('Full')
  expect(barOf(seen)).toBeDefined()
  expect(seen.texts).toContain(FIRE_TIME)
  expect(crabOf(seen)).toBeDefined()
  expect(hasButton(seen, 'spindle-crew')).toBe(true)
  expect(hasButton(seen, 'spindle-dismiss')).toBe(true)
})

test('the band shows the slug whole or as an icon, and keeps the bar while it fits', { timeoutMs: 60_000 }, async ($, on) => {
  await fireRun($, on)

  const atWidth = new Map<number, Seen>()
  for (const width of WIDTHS) atWidth.set(width, await seenAt($, 'desktop', width))

  const slugWidths = WIDTHS.filter(width => atWidth.get(width)?.texts.includes(FIRE_SLUG))
  const barWidths = WIDTHS.filter(width => barOf(atWidth.get(width) as Seen) !== undefined)
  for (const width of WIDTHS) {
    const seen = atWidth.get(width) as Seen
    expect([...seen.texts, ...seen.cardTexts].some(text => text.includes('…'))).toBe(false)
    for (const text of seen.texts.filter(one => one.startsWith('mac-'))) expect(text).toContain(FIRE_SLUG)
    expect(seen.texts).toContain(FIRE_TIME)
    expect(crabOf(seen)).toBeDefined()
    expect(hasButton(seen, 'spindle-crew')).toBe(true)
    expect(hasButton(seen, 'spindle-dismiss')).toBe(true)
  }
  expect(isUnbrokenUpTo(slugWidths, 160)).toBe(true)
  expect(isUnbrokenUpTo(barWidths, 160)).toBe(true)
  const belowSlug = atWidth.get((slugWidths[0] ?? 0) - 1) as Seen
  expect(hasButton(belowSlug, 'spindle-name')).toBe(true)
  expect(barOf(belowSlug)).toBeDefined()
  const narrowest = atWidth.get(40) as Seen
  expect(hasButton(narrowest, 'spindle-name')).toBe(true)
  expect(narrowest.texts).toContain('Review · R5')
  expect(barOf(narrowest)).toBeUndefined()
})

test('the terminal band follows the same rules', async ($, on) => {
  await fireRun($, on)

  const wide = (await seenAt($, 'terminal', 160)).texts.find(text => text.startsWith('●')) ?? ''
  const narrow = (await seenAt($, 'terminal', 40)).texts.find(text => text.startsWith('●')) ?? ''

  expect(wide).toContain(FIRE_SLUG)
  expect(wide).toContain('[Full]')
  expect(wide).toMatch(/[█░]/)
  expect(narrow).toContain('Review · R5')
  expect(narrow).toContain(FIRE_TIME)
  expect(narrow).not.toContain(FIRE_SLUG)
  expect(narrow).not.toMatch(/[█░]/)
  expect(wide).not.toContain('…')
  expect(narrow).not.toContain('…')
})

test("the band's parts fit its width", { timeoutMs: 60_000 }, async ($, on) => {
  const world = harness(on, fireplace, { now: NOW })
  await world.start($)

  for (const width of WIDTHS) {
    const seen = await seenAt($, 'desktop', width)
    expect(seen.texts).toContain(FIRE_TIME)
    expect(columnsDrawn(seen)).toBeLessThanOrEqual(width)
    const bar = barOf(seen)
    if (bar !== undefined) expect(bar.width).toBeGreaterThanOrEqual(REVIEW_PILL_W + 96)
  }
})

test("the fireplace run's pill reads Review R5", async ($, on) => {
  const world = harness(on, fireplace, { now: NOW })
  await world.start($)

  const band = await mountBand($, 'desktop', 160)
  const seen = seenOf(await band.drawn())
  expect(barOf(seen)?.alt).toBe('mac-video-audio-and-recorder-ui: Review · R5')
  const card = seenOf(await band.find({ key: 'spindle-progress-hint' })).cardTexts
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

  const band = await mountBand($, 'desktop', 160)
  const bar = seenOf(await band.find({ key: 'spindle-progress-hint' })).svgs[0]
  expect(bar?.alt).toBe('rate-limit-api: Integrate')
})

test('band hover cards and the copy icon', async ($, on) => {
  const world = await fireRun($, on, true)

  const wide = await seenAt($, 'desktop', 160)
  expect(wide.cardTexts).toContain('mac-video-audio-and-recorder-ui · Full lane')
  expect(wide.cardTexts).toContain('Show the Pipeline pane · 1 working now')
  expect(wide.cardTexts).toContain('Hide until an MSP moves to a new activity')

  const narrow = await mountBand($, 'desktop', 60)
  expect(seenOf(await narrow.find({ key: 'spindle-name-hint' })).cardTexts).toContain('mac-video-audio-and-recorder-ui · Full lane')
  await narrow.press({ key: 'spindle-name' })

  expect(world.copies()).toEqual(['mac-video-audio-and-recorder-ui'])
})

test('the count button opens the pane', async ($, on) => {
  const world = await fireRun($, on, true)

  const band = await mountBand($, 'desktop', 160)
  const card = seenOf(await band.find({ key: 'spindle-crew-card' }))
  expect(crabOf(card)).toBeDefined()
  expect(card.buttons).toEqual([{ ...COUNT_BUTTON, drawn: '×1' }])
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
  expect(seen.texts).toContain('rate-limit-api')
  expect(seen.texts).toContain('Full')
  const bar = seen.svgs.find(svg => svg.alt === 'rate-limit-api: Review · R1')
  expect(bar?.source).toContain('Review · R1')
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

test('every glyph control is named in words', async ($, on) => {
  await fireRun($, on, true)

  const narrow = await seenAt($, 'desktop', 60)
  expect(narrow.buttons.find(button => button.key === 'spindle-name')).toEqual({ key: 'spindle-name', drawn: '◉', name: 'Copy the thread name' })
  expect(narrow.buttons.find(button => button.key === 'spindle-crew')).toEqual({ ...COUNT_BUTTON, drawn: '×1' })
  expect(narrow.buttons.find(button => button.key === 'spindle-dismiss')).toEqual(DISMISS_BUTTON)
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
