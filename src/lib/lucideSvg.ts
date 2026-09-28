import * as Lucide from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { autoInk, type Theme } from './colors'

export function getLucideIcon(name: string): LucideIcon | null {
  try {
    const Icon = (Lucide as unknown as Record<string, LucideIcon>)[name]
    // In lucide-react v1.x, icons are objects (ForwardRef components)
    // Simply check if the icon exists (is truthy)
    if (Icon && (typeof Icon === 'function' || typeof Icon === 'object')) {
      return Icon as LucideIcon
    }
    return null
  } catch (error) {
    console.error(`Error getting icon "${name}":`, error)
    return null
  }
}

// Data-URL rendering goes through react-dom/server, so memoise it. Auto icons
// re-render on every theme change, and this keeps that cheap.
const dataUrlCache = new Map<string, string>()

export function lucideToDataUrl(name: string, color = '#18181b', size = 96, strokeWidth = 2): string {
  const Icon = getLucideIcon(name)
  if (!Icon) return ''

  const cacheKey = `${name}|${color}|${size}|${strokeWidth}`
  const cached = dataUrlCache.get(cacheKey)
  if (cached !== undefined) return cached

  try {
    // Render the lucide icon to SVG string using React
    const iconElement = createElement(Icon, { 
      size, 
      color, 
      strokeWidth,
      absoluteStrokeWidth: true 
    })
    const svgString = renderToStaticMarkup(iconElement)
    
    // Convert SVG string to data URL
    const url = `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`
    dataUrlCache.set(cacheKey, url)
    return url
  } catch (error) {
    console.error(`Error converting icon "${name}" to data URL:`, error)
    return ''
  }
}

/**
 * Icons are SVG data URLs with the stroke baked in, so an "auto" icon is
 * re-rendered per frame rather than re-coloured in stored data. Custom icons
 * return undefined so the caller keeps their stored `src`.
 */
export function resolveIconSrc(
  obj: { assetKind?: string; iconName?: string; colorMode?: string },
  theme: Theme,
): string | undefined {
  if (obj.assetKind !== 'icon' || !obj.iconName) return undefined
  if (obj.colorMode !== 'auto') return undefined
  return lucideToDataUrl(obj.iconName, autoInk(theme))
}

export function stickerToDataUrl(label: string, bg: string, fg: string, width = 180, height = 44): string {
  const escaped = label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect x="0" y="0" width="${width}" height="${height}" rx="${height / 2}" fill="${bg}"/>
    <text x="${width / 2}" y="${height / 2 + 5}" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="14" font-weight="700" fill="${fg}">${escaped}</text>
  </svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
