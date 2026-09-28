export const BOARD_COLOR_MAP: Record<string, string> = {
  white: '#ffffff',
  cream: '#fefce8',
  sky: '#f0f9ff',
  mint: '#f0fdf4',
  lavender: '#faf5ff',
  dark: '#18181b',
}

export const LINE_COLOR_MAP: Record<string, string> = {
  white: '#e5e7eb',
  cream: '#d9f099',
  sky: '#bae6fd',
  mint: '#bbf7d0',
  lavender: '#ddd6fe',
  dark: '#3f3f46',
}

export interface BoardSurface {
  bg: string
  line: string
  dot: string
}

/**
 * Each board colour is a tint family with a light and a dark rendering, so the
 * canvas follows the app theme instead of staying bright in dark mode.
 */
export const BOARD_SURFACES: Record<string, { light: BoardSurface; dark: BoardSurface }> = {
  white: {
    light: { bg: '#ffffff', line: '#e5e7eb', dot: '#d1d5db' },
    dark: { bg: '#18181b', line: '#3f3f46', dot: '#52525b' },
  },
  cream: {
    light: { bg: '#fefce8', line: '#d9f099', dot: '#d1d5db' },
    dark: { bg: '#1c1917', line: '#44403c', dot: '#57534e' },
  },
  sky: {
    light: { bg: '#f0f9ff', line: '#bae6fd', dot: '#d1d5db' },
    dark: { bg: '#0c1520', line: '#1e3a5f', dot: '#334155' },
  },
  mint: {
    light: { bg: '#f0fdf4', line: '#bbf7d0', dot: '#d1d5db' },
    dark: { bg: '#0d1a12', line: '#14532d', dot: '#334155' },
  },
  lavender: {
    light: { bg: '#faf5ff', line: '#ddd6fe', dot: '#d1d5db' },
    dark: { bg: '#16101f', line: '#3b2f55', dot: '#3f3f5c' },
  },
  dark: {
    light: { bg: '#18181b', line: '#3f3f46', dot: '#52525b' },
    dark: { bg: '#09090b', line: '#27272a', dot: '#3f3f46' },
  },
}

export function resolveBoardSurface(boardColor: string, theme: 'light' | 'dark'): BoardSurface {
  const entry = BOARD_SURFACES[boardColor] ?? BOARD_SURFACES.white
  return theme === 'dark' ? entry.dark : entry.light
}

/** Minimum contrast ratio for ink to read clearly against a surface (WCAG large-text/non-text). */
export const MIN_INK_CONTRAST = 3

export type Theme = 'light' | 'dark'

/**
 * The canvas surface is its own axis of colour. It is deliberately independent
 * of every ink/stroke value: nothing derives the board from a stroke colour, and
 * nothing derives a stroke from the board except at render time via
 * `autoInk`. Mirrored in index.css as `--canvas-bg`.
 */
export const CANVAS_BG: Record<Theme, string> = {
  light: '#ffffff',
  dark: '#000000',
}

/**
 * Ink used for "auto" marks — anything the user drew without deliberately
 * choosing a colour. Resolved per render so a theme switch instantly updates
 * visibility without rewriting stored data. Mirrored in index.css as `--auto-ink`.
 */
export const AUTO_INK: Record<Theme, string> = {
  light: '#09090b',
  dark: '#fafafa',
}

export function canvasBg(theme: Theme): string {
  return CANVAS_BG[theme] ?? CANVAS_BG.light
}

export function autoInk(theme: Theme): string {
  return AUTO_INK[theme] ?? AUTO_INK.light
}

/**
 * The colour a mark should actually paint with right now.
 *
 * `auto` marks ignore any stored hex and follow the theme. `custom` marks (and
 * anything predating colorMode, e.g. template content) keep their literal
 * colour forever, so a deliberately-chosen red never inverts.
 */
export function resolveMarkColor(
  obj: { colorMode?: string; stroke?: string; fill?: string },
  theme: Theme,
  field: 'stroke' | 'fill',
): string | undefined {
  if (obj.colorMode === 'auto') return autoInk(theme)
  const value = field === 'stroke' ? obj.stroke : obj.fill
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (typeof hex !== 'string') return null
  let h = hex.trim().replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (!/^[0-9a-f]{6}$/i.test(h)) return null
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function toHex(n: number) {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
}

/** WCAG relative luminance. */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 1
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b)
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  if (!ca || !cb) return a
  const mix = (x: number, y: number) => x + (y - x) * t
  return `#${toHex(mix(ca.r, cb.r))}${toHex(mix(ca.g, cb.g))}${toHex(mix(ca.b, cb.b))}`
}

/**
 * Nudge `inkHex` toward black or white until it clears `minRatio` against
 * `bgHex`, preserving as much of the original hue as possible. Returns the
 * original color when it is already readable.
 */
export function ensureContrast(inkHex: string, bgHex: string, minRatio = MIN_INK_CONTRAST): string {
  if (!hexToRgb(inkHex) || !hexToRgb(bgHex)) return inkHex
  if (contrastRatio(inkHex, bgHex) >= minRatio) return inkHex

  // Light surface -> darken the ink; dark surface -> lighten it.
  const target = relativeLuminance(bgHex) > 0.4 ? '#000000' : '#ffffff'
  let best = inkHex
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    best = mixHex(inkHex, target, t)
    if (contrastRatio(best, bgHex) >= minRatio) return best
  }
  return best
}

export function isLowContrast(inkHex: string, bgHex: string, minRatio = MIN_INK_CONTRAST): boolean {
  if (!hexToRgb(inkHex) || !hexToRgb(bgHex)) return false
  return contrastRatio(inkHex, bgHex) < minRatio
}

/** Canonical ink for light and dark surfaces. */
export const DARK_INK = '#09090b'
export const LIGHT_INK = '#fafafa'

/**
 * True for near-black / near-white colours — the shades that exist purely to
 * contrast with the surface rather than to be a deliberate choice. Only these
 * are remapped on a theme switch, so a red or a brand purple is left alone.
 */
export function isThemeInk(hex: string): boolean {
  if (!hexToRgb(hex)) return false
  const l = relativeLuminance(hex)
  return l < 0.06 || l > 0.9
}

interface Hsl { h: number; s: number; l: number }

function hexToHsl(hex: string): Hsl | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l }
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0))
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return { h: h * 60, s, l }
}

function hslToHex({ h, s, l }: Hsl): string {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let rgb: [number, number, number]
  if (h < 60) rgb = [c, x, 0]
  else if (h < 120) rgb = [x, c, 0]
  else if (h < 180) rgb = [0, c, x]
  else if (h < 240) rgb = [0, x, c]
  else if (h < 300) rgb = [x, 0, c]
  else rgb = [c, 0, x]
  return `#${toHex((rgb[0] + m) * 255)}${toHex((rgb[1] + m) * 255)}${toHex((rgb[2] + m) * 255)}`
}

/**
 * Lightness is judged by WCAG luminance, not HSL lightness: a saturated
 * indigo like #4f46e5 has a high HSL lightness but reads as a dark colour, so
 * an HSL test would wrongly crush it. These cut-offs sit above every accent
 * used by the templates and below every pale surface tint.
 */
const SURFACE_IS_LIGHT_ABOVE = 0.62
const INK_IS_DARK_BELOW = 0.18

/** Retarget a *surface* fill (a card, panel or note background) for dark mode. */
export function adaptSurface(hex: string, toDark: boolean): string {
  if (!toDark) return hex
  const hsl = hexToHsl(hex)
  if (!hsl) return hex
  // Already dark or a saturated accent: it reads fine on a dark board as-is.
  if (relativeLuminance(hex) <= SURFACE_IS_LIGHT_ABOVE) return hex
  return hslToHex({ h: hsl.h, s: Math.min(0.45, hsl.s * 0.55), l: 0.22 })
}

/** Retarget an *ink* colour (text, label, outline) so it reads on a dark board. */
export function adaptInk(hex: string, toDark: boolean): string {
  if (!toDark) return hex
  const hsl = hexToHsl(hex)
  if (!hsl) return hex
  if (relativeLuminance(hex) >= INK_IS_DARK_BELOW) return hex
  return hslToHex({ h: hsl.h, s: Math.min(0.3, hsl.s * 0.45), l: 0.92 })
}

const SURFACE_FILL_FIELDS = ['fill']
const SURFACE_STROKE_FIELDS = ['stroke']
const INK_FILL_FIELDS = ['textColor', 'labelColor']
const ADAPTABLE_TYPES = new Set(['card', 'rectangle', 'ellipse', 'circle', 'triangle', 'polygon', 'text', 'sticky', 'frame', 'path', 'line', 'arrow'])

/**
 * Retarget a newly-created object's colours for the active theme. Templates are
 * authored for a light board, so applying one in dark mode would otherwise drop
 * a screen full of near-white cards onto a dark canvas.
 */
export function adaptObjectForTheme<T extends Record<string, any>>(obj: T, toDark: boolean): T {
  if (!toDark) return obj
  if (!ADAPTABLE_TYPES.has(obj.type as string)) return obj
  const patch: Record<string, any> = {}
  for (const key of SURFACE_FILL_FIELDS) {
    const v = obj[key]
    if (typeof v === 'string' && v !== 'transparent') patch[key] = adaptSurface(v, toDark)
  }
  for (const key of SURFACE_STROKE_FIELDS) {
    const v = obj[key]
    if (typeof v === 'string' && v !== 'transparent') patch[key] = adaptInk(v, toDark)
  }
  for (const key of INK_FILL_FIELDS) {
    const v = obj[key]
    if (typeof v === 'string') patch[key] = adaptInk(v, toDark)
  }
  // A text object's fill IS its ink.
  if (obj.type === 'text' && typeof obj.fill === 'string') {
    patch.fill = adaptInk(obj.fill, toDark)
  }
  return Object.keys(patch).length ? { ...obj, ...patch } : obj
}

/**
 * Ink to use against `bgHex`.
 *
 * Colours that already read well (a red pen, say) are left untouched so the
 * user's choice survives a theme switch. Only inks whose polarity fights the
 * surface — near-black on a dark board, white on a light one — are flipped to
 * the matching canonical ink, so the pen visibly follows the theme instead of
 * settling on a muddy mid grey.
 */
export function inkForSurface(inkHex: string, bgHex: string, minRatio = MIN_INK_CONTRAST): string {
  if (!hexToRgb(inkHex) || !hexToRgb(bgHex)) return inkHex
  if (contrastRatio(inkHex, bgHex) >= minRatio) return inkHex

  const surfaceIsLight = relativeLuminance(bgHex) > 0.4
  const inkIsLight = relativeLuminance(inkHex) > 0.4

  // Polarity is inverted: the ink belongs to the opposite theme.
  if (surfaceIsLight === inkIsLight) {
    return surfaceIsLight ? DARK_INK : LIGHT_INK
  }
  return ensureContrast(inkHex, bgHex, minRatio)
}
