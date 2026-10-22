import type { Role } from '../../types'

export const CLAY = '#D97757'
export const INK = '#1F1E1D'
export const CRAB_BOX = 30

export const ROLE_COLOR = {
  interphase: '#7F77DD',
  mitosis: '#1D9E75',
  review: '#D85A30',
  verdict: '#BA7517',
  ship: '#378ADD',
  continuity: '#888780',
} as const

export type Costume = 'captain' | 'scribe' | 'builder' | 'detective' | 'judge' | 'courier' | 'plain'

type Rect = { x: number; y: number; w: number; h: number; fill: string; cls: string }
type Palette = Readonly<Record<string, string>>

const rect = (x: number, y: number, w: number, h: number, fill: string, cls = 'bd'): Rect => ({ x, y, w, h, fill, cls })

const stamp = (x: number, y: number, rows: readonly string[], map: Palette, cls?: string): Rect[] =>
  rows.flatMap((row, dy) =>
    [...row].flatMap((ch, dx) => {
      const fill = map[ch]
      return fill ? [rect(x + dx, y + dy, 1, 1, fill, cls)] : []
    }),
  )

const crabBody = (armFront = 0, armCls?: string): Rect[] => [
  rect(7, 10, 16, 12, CLAY),
  rect(3, 14, 4, 4, CLAY),
  rect(23, 14 + armFront, 4, 4, CLAY, armCls),
  rect(9, 12, 2, 2, INK),
  rect(19, 12, 2, 2, INK),
  rect(7, 22, 2, 4, CLAY, 'la'),
  rect(17, 22, 2, 4, CLAY, 'la'),
  rect(11, 22, 2, 4, CLAY, 'lb'),
  rect(21, 22, 2, 4, CLAY, 'lb'),
]

export const CRAB_CSS = `<style>
.run .la{animation:st .5s steps(1) infinite}.run .lb{animation:st .5s steps(1) infinite -.25s}
.run .bd{animation:bob .5s steps(1) infinite -.125s}
.run g{transform-box:fill-box}
@keyframes st{50%{transform:translateY(-1px)}}@keyframes bob{50%{transform:translateY(1px)}}
@keyframes blink{50%{opacity:.15}}
@keyframes page{50%{transform:scaleX(-1)}}
.c-scribe.run .it{transform-origin:0 100%;animation:scrib .5s ease-in-out infinite}
@keyframes scrib{25%{transform:rotate(-14deg)}75%{transform:rotate(10deg)}}
.c-builder.run .it{transform-origin:100% 100%;animation:twist .5s ease-in-out infinite}
@keyframes twist{50%{transform:rotate(-35deg)}}
.c-detective.run .it{animation:scan 1s steps(1) infinite}
.c-detective.run .gl{animation:blink 1s steps(1) infinite -.5s}
@keyframes scan{25%{transform:translate(-1px,1px)}50%{transform:translate(-2px,2px)}75%{transform:translate(-1px,1px)}}
.c-judge.run .it{transform-origin:0 100%;animation:gavel 1s cubic-bezier(.6,0,.4,1) infinite}
@keyframes gavel{0%,40%{transform:rotate(-40deg)}55%{transform:rotate(8deg)}70%,100%{transform:rotate(0)}}
.c-captain.run .pg{transform-origin:0 50%;animation:page 2s ease-in-out infinite}
.c-courier.run .it{animation:hop .5s steps(1) infinite}
@keyframes hop{50%{transform:translate(1px,-2px)}}
@media (prefers-reduced-motion: reduce){.run,.run g{animation:none!important}}
</style>`

const COSTUMES: Readonly<Record<Costume, (t: string) => Rect[]>> = {
  scribe: t => [
    ...crabBody(-4),
    ...stamp(6, 5, ['......bbbbbb......', '...bbbbbbbbbbbb...', '..bbbbbbbbbbbbbb..', '.bbbbbbbbbbbbbbbb.', 'dddddddddddddddddd'], { b: t, d: '#3E3A73' }),
    rect(14, 4, 2, 1, '#3E3A73'),
    ...stamp(24, 0, ['...w', '..ww', '.wwg', 'wwg.', 'wg..', 'k...', 'k...'], { w: '#F8F6F1', g: '#D2D1C8', k: INK }, 'it'),
  ],
  builder: t => [
    ...crabBody(),
    ...stamp(6, 4, ['.....yyyyyyyy.....', '...yyyyyhhyyyyy...', '..yyyyyyhhyyyyyy..', '..yyyyyyhhyyyyyy..', '.yyyyyyyhhyyyyyyy.', 'dddddddddddddddddd'], { y: '#F5C542', h: '#FBE08A', d: '#C99A1E' }),
    rect(13, 5, 4, 2, t),
    ...stamp(0, 10, ['.s.s', 'sss.', '.s..', '.s..'], { s: '#8E929A' }, 'it'),
  ],
  detective: t => [
    ...crabBody(-4, 'it'),
    ...stamp(6, 3, ['......bbbbbb......', '....bbcbbcbbbb....', '...bbbbbbbbbbbb...', '..bcbbcbbcbbcbbb..', '.bbbbbbbbbbbbbbbb.', 'dddddddddddddddddd'], { b: '#7A4A26', c: '#A0703F', d: '#5A3519' }),
    rect(6, 9, 18, 1, t),
    ...stamp(23, 1, ['.kkk.', 'k...k', 'k...k', 'k...k', '.kkk.'], { k: '#3A3A3C' }, 'it'),
    rect(24, 2, 3, 3, 'rgba(169,214,245,.7)', 'it'),
    rect(25, 6, 1, 4, '#7A4A26', 'it'),
    rect(24, 2, 1, 1, '#fff', 'gl'),
  ],
  judge: t => [
    ...crabBody(-4),
    ...stamp(5, 3, ['....wwwwwwwwww....', '..wwgwwgwwgwwgww..', '.wwwwwwwwwwwwwwww.', 'wgwwgww....wwgwwgw', 'ww..............ww', 'wg..............gw', 'ww..............ww', 'wg..............gw'], { w: '#F4F3EE', g: '#D2D1C8' }),
    rect(13, 18, 4, 2, t),
    ...stamp(23, 3, ['.bbbbb', '.bbbbb', '...h..', '...h..', '...h..', '...h..', '...h..'], { b: '#7A4A26', h: '#A0703F' }, 'it'),
  ],
  captain: () => [
    ...crabBody(),
    ...stamp(5, 5, ['....nnnnnnnnnn....', '..nnnnnnnnnnnnnn..', '.wwwwwwwwwwwwwwww.', '.nnnnnnnggnnnnnnn.', 'kkkkkkkkkkkkkkkkkk.'], { n: '#2B3A55', w: '#F4F3EE', g: '#F5C542', k: INK }),
    ...stamp(9, 17, ['nnnnn.nnnnn', 'nllll.lllln', 'nnnnn.nnnnn'], { n: '#2B3A55', l: '#C9CCD2' }),
    rect(15, 17, 5, 3, '#3A4D70', 'pg'),
  ],
  courier: t => [
    ...crabBody(-4, 'it'),
    ...stamp(6, 6, ['...cccccccccccc...', '..cccccccccccccc..', '.cccccccccccccccc.', 'bbbbbbbbbbbbbbbbbbbbbb'], { c: t, b: '#1F4E7A' }),
    ...stamp(22, 5, ['eeeeeeee', 'ewe..ewe', 'e.weew.e', 'e..ww..e', 'eeeeeeee'], { e: '#F8F6F1', w: '#C9CCD2' }, 'it'),
  ],
  plain: () => crabBody(),
}

const ROLE_LOOK: Readonly<Record<Role, { costume: Costume; color: string }>> = {
  captain: { costume: 'captain', color: ROLE_COLOR.continuity },
  scribe: { costume: 'scribe', color: ROLE_COLOR.interphase },
  builder: { costume: 'builder', color: ROLE_COLOR.mitosis },
  detective: { costume: 'detective', color: ROLE_COLOR.review },
  judge: { costume: 'judge', color: ROLE_COLOR.verdict },
  courier: { costume: 'courier', color: ROLE_COLOR.ship },
  plain: { costume: 'plain', color: ROLE_COLOR.continuity },
}

export const costumeOf = (role: Role): Costume => ROLE_LOOK[role].costume

export const colorOf = (role: Role): string => ROLE_LOOK[role].color

const LEGS = new Set(['bd', 'la', 'lb'])

export function crab(
  x: number,
  y: number,
  costume: Costume,
  color: string,
  dim = false,
  isWalking = false,
  scale = 1.1,
  mirror = false,
): string {
  const rects = COSTUMES[costume](color)
  const rectsOf = (cls: string) =>
    rects
      .filter(one => one.cls === cls)
      .map(one => `<rect x="${one.x}" y="${one.y}" width="${one.w}" height="${one.h}" fill="${one.fill}"/>`)
      .join('')
  const group = (cls: string) => `<g class="${cls}">${rectsOf(cls)}</g>`
  const props = [...new Set(rects.map(one => one.cls))].filter(cls => !LEGS.has(cls))
  const body = `<g class="bd">${rectsOf('bd')}${props.map(group).join('')}</g>`
  const place = mirror
    ? `translate(${x + CRAB_BOX * scale},${y}) scale(${-scale},${scale})`
    : `translate(${x},${y}) scale(${scale})`
  return `<g transform="${place}" opacity="${dim ? 0.45 : 1}" shape-rendering="crispEdges"><g class="c-${costume}${isWalking ? ' run' : ''}">${body}${group('la')}${group('lb')}</g></g>`
}

export type CelebrationLook = { crew: readonly Role[]; scale: number; step: number; inset: number; hopPx: number }

const HOP_SECONDS = 0.6
const HOP_STAGGER_SECONDS = 0.2

export const celebrationSize = (look: CelebrationLook) => ({
  width: look.step * look.crew.length,
  height: Math.ceil(CRAB_BOX * look.scale) + look.hopPx,
})

const hopCss = (look: CelebrationLook) => `<style>
.hop{animation-name:hop-${look.hopPx};animation-duration:${HOP_SECONDS}s;animation-timing-function:ease-out;animation-iteration-count:1;animation-fill-mode:both}
${look.crew.map((_, i) => `.hop-${i}{animation-delay:${(i * HOP_STAGGER_SECONDS).toFixed(1)}s}`).join('')}
@keyframes hop-${look.hopPx}{0%,100%{transform:translateY(0)}45%{transform:translateY(-${look.hopPx}px)}}
@media (prefers-reduced-motion: reduce){.hop{animation:none}}
</style>`

export function celebrationSvg(look: CelebrationLook, isSettled: boolean): string {
  const { width, height } = celebrationSize(look)
  const crabs = look.crew
    .map(
      (role, i) =>
        `<g class="hop hop-${i}">${crab(i * look.step + look.inset, look.hopPx, costumeOf(role), colorOf(role), false, false, look.scale)}</g>`,
    )
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${isSettled ? '' : hopCss(look)}${crabs}</svg>`
}
