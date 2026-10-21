import type { Stage } from '../../types'
import { CRAB_CSS, ROLE_COLOR } from './crew'

export const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',system-ui,sans-serif"
export const ACCENT = '#8f8cf4'
export const DONE = '#5fbf8f'
export const FAIL = '#D0453F'
export const LANE_COLORS = ['#1D9E75', '#378ADD', '#BA7517', '#7F77DD', '#D85A30'] as const

export type StageInfo = { id: Stage; name: string; color: string }

export const STAGE_TABLE: readonly StageInfo[] = [
  { id: 'spec', name: 'Spec', color: ROLE_COLOR.interphase },
  { id: 'build', name: 'Build', color: ROLE_COLOR.mitosis },
  { id: 'review', name: 'Review', color: ROLE_COLOR.review },
  { id: 'fix', name: 'Fix', color: ROLE_COLOR.verdict },
  { id: 'ship', name: 'Ship', color: ROLE_COLOR.ship },
  { id: 'integrate', name: 'Integrate', color: ROLE_COLOR.ship },
  { id: 'clean', name: 'Clean-up', color: ROLE_COLOR.continuity },
]

export const THEME_CSS = `<style>
.sv-t{fill:#77776f}.sv-s{fill:#85857f}.sv-m{fill:#93938d}.sv-k{fill:rgba(128,128,120,.24)}.sv-tile{fill:rgba(128,128,120,.12)}
.sv-tk{fill:#93938d;opacity:.6}.sv-mstroke{stroke:#93938d}.sv-mfill{fill:#93938d}
.sv-live{animation:sv-p 1.6s ease-in-out infinite}@keyframes sv-p{50%{opacity:.3}}
@media (prefers-reduced-motion: reduce){.sv-live{animation:none}}
</style>`

const ESCAPES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }

export const xml = (value: unknown) => String(value).replace(/[&<>"]/g, ch => ESCAPES[ch] ?? ch)

export const noise = (x: number, y: number) => {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return s - Math.floor(s)
}

export const charEm = (ch: string) => (/[\s.,:;'|!il1()[\]]/.test(ch) ? 0.3 : /[A-Z@%mw]/.test(ch) ? 0.72 : 0.56)

export const textWidth = (s: string, size: number) => [...s].reduce((w, ch) => w + charEm(ch) * size, 0)

export const CELL_PX = 8

export const TEXT_PX = 13

export const columnsOf = (s: string) => Math.max([...s].length, Math.ceil(textWidth(s, TEXT_PX) / CELL_PX))

const FIT_SLACK = 0.01

export function fitText(s: string, size: number, maxW: number): string {
  if (textWidth(s, size) <= maxW + FIT_SLACK) return s
  const chars = [...s]
  const kept = chars.findIndex((_, i) => textWidth(chars.slice(0, i + 1).join('') + '…', size) > maxW + FIT_SLACK)
  return chars.slice(0, kept === -1 ? chars.length : kept).join('') + '…'
}

export const stageIndex = (stage: Stage | 'unknown') => STAGE_TABLE.findIndex(one => one.id === stage)

export const stageInfo = (stage: Stage | 'unknown'): StageInfo | null => STAGE_TABLE[stageIndex(stage)] ?? null

export type Mark = 'running' | 'done' | 'failed' | 'pending'

export function statusMark(x: number, y: number, status: Mark, color: string): string {
  if (status === 'running') return `<circle class="sv-live" cx="${x}" cy="${y}" r="3.5" fill="${color}"/>`
  if (status === 'done') {
    return `<path d="M${x - 5} ${y}l3.5 3.5 6.5-7" fill="none" stroke="#3B9C5F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
  }
  if (status === 'failed') {
    return `<path d="M${x - 4} ${y - 4}l8 8M${x + 4} ${y - 4}l-8 8" stroke="${FAIL}" stroke-width="1.8" stroke-linecap="round"/>`
  }
  return `<circle cx="${x}" cy="${y}" r="5" fill="none" class="sv-mstroke" stroke-width="1.4"/>`
}

export const svg = (W: number, H: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${THEME_CSS}${CRAB_CSS}${body}</svg>`

export const CHIP_H = 16
const CHIP_PX = 10.5
const CHIP_PAD = 12
const SEMIBOLD_WIDTH = 1.08

export const chipWidthOf = (label: string) => Math.ceil(textWidth(label, CHIP_PX) * SEMIBOLD_WIDTH) + CHIP_PAD

export function chipSvg(label: string): string {
  const W = chipWidthOf(label)
  return svg(
    W,
    CHIP_H,
    `<rect class="sv-k" y="1" width="${W}" height="${CHIP_H - 2}" rx="4"/>
<text class="sv-s" x="${W / 2}" y="${CHIP_H / 2 + 3.5}" text-anchor="middle" font-family="${FONT}" font-size="${CHIP_PX}" font-weight="600">${xml(label)}</text>`,
  )
}
