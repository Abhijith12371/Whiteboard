import { Settings, EyeOff, PaintBucket } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { useBoardStore } from '../../store/boardStore'
import { DARK_INK, LIGHT_INK, canvasBg, isLowContrast } from '../../lib/colors'
import { recolorIcons } from '../../lib/iconColors'

const PRESET_COLORS = [
  { value: DARK_INK, label: 'Black' },
  { value: LIGHT_INK, label: 'White' },
  { value: '#ef4444', label: 'Red' },
  { value: '#f97316', label: 'Orange' },
  { value: '#eab308', label: 'Yellow' },
  { value: '#22c55e', label: 'Green' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
]
const SIZE_PRESETS = [
  { diameter: 6, value: 2, label: 'Extra small' },
  { diameter: 9, value: 4, label: 'Small' },
  { diameter: 13, value: 8, label: 'Medium' },
  { diameter: 17, value: 14, label: 'Large' },
]

export function StylePanel() {
  const isPresenting = useUIStore(s => s.isPresenting)
  const penColor = useUIStore(s => s.penColor)
  const penColorMode = useUIStore(s => s.penColorMode)
  const penSize = useUIStore(s => s.penSize)
  const theme = useUIStore(s => s.theme)
  const setPenColor = useUIStore(s => s.setPenColor)
  const setPenColorMode = useUIStore(s => s.setPenColorMode)
  const setPenSize = useUIStore(s => s.setPenSize)
  const setToast = useUIStore(s => s.setToast)

  if (isPresenting) return null

  const handleRecolorAll = () => {
    useBoardStore.getState().recolorAllInk(penColor)
    // Re-read after the call; a pre-call snapshot would be stale.
    const inkCount = useBoardStore.getState().lastRecolorCount
    const count = inkCount + recolorIcons(penColor)
    const message = count > 0
      ? `Recoloured ${count} ${count === 1 ? 'object' : 'objects'} — Ctrl+Z to undo`
      : 'Nothing to recolour'
    setToast(message)
    window.setTimeout(() => {
      if (useUIStore.getState().toast === message) setToast(null)
    }, 2800)
  }

  // Warn when the chosen ink is too close to the board to read. The canvas is
  // the pure canvas token; the board tint only tints it decoratively.
  const lowContrast = penColorMode === 'custom' && isLowContrast(penColor, canvasBg(theme))

  // Find closest size preset for selection indicator
  const closestSizePreset = SIZE_PRESETS.reduce((prev, curr) => 
    Math.abs(curr.value - penSize) < Math.abs(prev.value - penSize) ? curr : prev
  )

  return (
    <div 
      className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2 flex items-center gap-4 rounded-[14px] border backdrop-blur-md px-4 py-2.5 shadow-sm whitespace-nowrap overflow-x-auto max-w-[calc(100vw-200px)]"
      style={{ 
        background: 'var(--card)', 
        borderColor: 'var(--border)',
        boxShadow: 'var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05))',
      }}
    >
      {/* Color Group */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
          Color
          {lowContrast && (
            <span
              className="ml-1.5 inline-flex items-center gap-0.5 align-middle text-warning"
              title="This ink is hard to see on the current board background. Pick a darker or lighter colour."
            >
              <EyeOff size={11} aria-hidden="true" />
              <span className="sr-only">Warning: hard to see on this background</span>
            </span>
          )}
        </span>
        <div className="flex items-center gap-1.5">
          {/* Auto follows the theme: no colour is stored with the stroke. */}
          <button
            type="button"
            title="Auto (follows the theme)"
            aria-label="Auto colour, follows the theme"
            aria-pressed={penColorMode === 'auto'}
            onClick={() => setPenColorMode('auto')}
            className="rounded-full flex items-center justify-center border transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{
              width: 20,
              height: 20,
              background: 'linear-gradient(135deg, var(--foreground) 0%, var(--foreground) 50%, var(--background) 50%, var(--background) 100%)',
              borderColor: 'var(--border)',
              boxShadow: penColorMode === 'auto'
                ? '0 0 0 2px var(--card), 0 0 0 3px var(--border-accent, var(--border))'
                : undefined,
            }}
          >
            <span className="sr-only">Auto</span>
          </button>

          {PRESET_COLORS.map(c => {
            const isSelected = penColorMode === 'custom' && penColor.toLowerCase() === c.value.toLowerCase()
            return (
              <button
                key={c.value}
                title={c.label}
                aria-label={c.label}
                onClick={() => setPenColor(c.value)}
                className="rounded-full transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2"
                style={{
                  width: 20,
                  height: 20,
                  background: c.value,
                  border: c.value === '#ffffff' || c.value === '#fafafa'
                    ? '1px solid var(--border)'
                    : 'none',
                  boxShadow: isSelected 
                    ? `0 0 0 2px var(--card), 0 0 0 3px var(--border-accent, var(--border))`
                    : undefined,
                  transform: isSelected ? 'scale(1.15)' : undefined,
                }}
              />
            )
          })}

          {/* Custom color picker */}
          <label title="Custom color" className="relative cursor-pointer">
            <div
              className="rounded-full border border-dashed flex items-center justify-center hover:border-foreground/50 transition-colors"
              style={{ 
                width: 20, 
                height: 20,
                borderColor: 'var(--muted-foreground)',
                opacity: 0.6
              }}
            >
              <span style={{ fontSize: 12, lineHeight: 1, color: 'var(--muted-foreground)' }}>+</span>
            </div>
            <input
              type="color"
              value={penColor}
              onChange={e => setPenColor(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
              style={{ width: 20, height: 20 }}
              aria-label="Custom color picker"
            />
          </label>

          {/* Recolour every existing drawing with the selected ink */}
          <button
            type="button"
            onClick={handleRecolorAll}
            title={`Recolour all drawings to ${penColor} (Ctrl+Z to undo)`}
            aria-label="Recolour all drawings to the selected colour"
            className="rounded-full border flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{
              width: 20,
              height: 20,
              borderColor: 'var(--muted-foreground)',
              color: penColor,
            }}
          >
            <PaintBucket size={12} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-7 bg-border" style={{ background: 'var(--border)' }} />

      {/* Size Group */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
          Size
        </span>
        <div 
          className="flex items-center gap-2 rounded-full px-2.5 py-1.5"
          style={{ background: 'var(--muted, #f4f4f5)' }}
        >
          {SIZE_PRESETS.map(s => {
            const isSelected = closestSizePreset.value === s.value
            return (
              <button
                key={s.value}
                title={s.label}
                aria-label={`${s.label}: Size ${s.value}`}
                onClick={() => setPenSize(s.value)}
                className="rounded-full transition-all hover:scale-110 focus:outline-none"
                style={{
                  width: s.diameter,
                  height: s.diameter,
                  background: 'var(--foreground)',
                  opacity: isSelected ? 1 : 0.35,
                  boxShadow: isSelected 
                    ? `0 0 0 2px ${penColor}15`
                    : undefined,
                  transform: isSelected ? 'scale(1.2)' : undefined,
                }}
              />
            )
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-7 bg-border" style={{ background: 'var(--border)' }} />

      {/* Fine-tune Group */}
      <div className="flex items-center gap-2">
        <Settings size={16} style={{ color: 'var(--muted-foreground)' }} aria-hidden="true" />
        <input
          type="range"
          min={1}
          max={50}
          value={penSize}
          onChange={e => setPenSize(Number(e.target.value))}
          className="w-20 accent-primary"
          style={{ accentColor: penColor }}
          aria-label="Fine-tune size"
        />
        <span 
          className="text-xs font-medium w-6 text-center" 
          style={{ color: 'var(--muted-foreground)' }}
          aria-live="polite"
        >
          {penSize}
        </span>
      </div>
    </div>
  )
}
