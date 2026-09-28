import { useUIStore } from '../../store/uiStore'

const PRESET_COLORS = [
  { value: '#09090b', label: 'Black' },
  { value: '#ef4444', label: 'Red' },
  { value: '#f97316', label: 'Orange' },
  { value: '#eab308', label: 'Yellow' },
  { value: '#22c55e', label: 'Green' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#6b7280', label: 'Gray' },
  { value: '#ffffff', label: 'White' },
]

const SIZE_PRESETS = [2, 4, 8, 14, 22]

export const ToolOptionsBar = () => {
  const activeTool = useUIStore(s => s.activeTool)
  const penColor = useUIStore(s => s.penColor)
  const penSize = useUIStore(s => s.penSize)
  const eraserSize = useUIStore(s => s.eraserSize)
  const setPenColor = useUIStore(s => s.setPenColor)
  const setPenSize = useUIStore(s => s.setPenSize)
  const setEraserSize = useUIStore(s => s.setEraserSize)

  const isPen = activeTool === 'pen'
  const isEraser = activeTool === 'eraser'
  const isPencil = activeTool === 'pencil'
  const isHighlighter = activeTool === 'highlighter'

  if (!isPen && !isEraser && !isPencil && !isHighlighter) return null

  return (
    <div
      className="absolute bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 flex flex-col sm:flex-row items-center gap-2 sm:gap-4 px-3 sm:px-5 py-2 sm:py-3 rounded-xl sm:rounded-2xl shadow-xl border border-border/50 z-20 max-w-[calc(100vw-2rem)]"
      style={{ background: 'var(--card)', backdropFilter: 'blur(12px)' }}
    >
      {/* Pen/Pencil/Highlighter Options */}
      {(isPen || isPencil || isHighlighter) && (
        <>
          {/* Color Presets */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <span className="text-xs font-semibold text-muted-foreground">Color</span>
            <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button
                  key={c.value}
                  title={c.label}
                  onClick={() => setPenColor(c.value)}
                  className="rounded-full transition-all hover:scale-110 focus:outline-none"
                  style={{
                    width: 20,
                    height: 20,
                    background: c.value,
                    border: penColor === c.value
                      ? '2.5px solid #3b82f6'
                      : c.value === '#ffffff'
                      ? '1.5px solid #d1d5db'
                      : '1.5px solid transparent',
                    transform: penColor === c.value ? 'scale(1.15)' : undefined,
                    boxShadow: penColor === c.value ? '0 0 0 1.5px #3b82f6' : undefined
                  }}
                />
              ))}

              {/* Custom color picker */}
              <label title="Custom color" className="relative cursor-pointer">
                <div
                  className="rounded-full border-2 border-dashed border-muted-foreground/50 hover:border-primary transition-colors flex items-center justify-center"
                  style={{ width: 20, height: 20, background: penColor }}
                >
                  <span style={{ fontSize: 9, color: 'var(--muted-foreground)', lineHeight: 1 }}>+</span>
                </div>
                <input
                  type="color"
                  value={penColor}
                  onChange={e => setPenColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  style={{ width: 20, height: 20 }}
                />
              </label>
            </div>
          </div>

          <div className="hidden sm:block w-px h-8 bg-border/30" />

          {/* Size Presets */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <span className="text-xs font-semibold text-muted-foreground">Size</span>
            <div className="flex items-center gap-1 sm:gap-1.5">
              {SIZE_PRESETS.map(s => (
                <button
                  key={s}
                  title={`${s}px`}
                  onClick={() => setPenSize(s)}
                  className="rounded-full bg-foreground transition-all hover:scale-110 focus:outline-none"
                  style={{
                    width: Math.min(s, 22),
                    height: Math.min(s, 22),
                    opacity: penSize === s ? 1 : 0.35,
                    transform: penSize === s ? 'scale(1.2)' : undefined,
                    background: penColor,
                    border: penSize === s ? '2px solid #3b82f6' : undefined
                  }}
                />
              ))}
            </div>
          </div>

          <div className="hidden sm:block w-px h-8 bg-border/30" />

          {/* Fine-grained size slider */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-semibold text-muted-foreground min-w-fit">Fine size</span>
            <input
              type="range"
              min={1}
              max={50}
              value={penSize}
              onChange={e => setPenSize(Number(e.target.value))}
              className="flex-1 sm:w-24 accent-primary"
            />
            <span className="text-xs font-medium text-muted-foreground w-6 text-center">{penSize}</span>
          </div>
        </>
      )}

      {/* Eraser Options */}
      {isEraser && (
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <div
            className="rounded-full border-2 border-muted-foreground/30 bg-background/50 hidden sm:block"
            style={{ width: Math.min(eraserSize, 44), height: Math.min(eraserSize, 44) }}
          />
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-semibold text-muted-foreground min-w-fit">Eraser Size</span>
            <input
              type="range"
              min={5}
              max={80}
              value={eraserSize}
              onChange={e => setEraserSize(Number(e.target.value))}
              className="flex-1 sm:w-24 accent-primary"
            />
            <span className="text-xs font-medium text-muted-foreground w-8 text-center">{eraserSize}</span>
          </div>
        </div>
      )}
    </div>
  )
}
