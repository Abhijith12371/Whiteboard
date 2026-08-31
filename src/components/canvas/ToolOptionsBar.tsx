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

  if (!isPen && !isEraser) return null

  return (
    <div
      className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2.5 rounded-2xl shadow-xl border border-border z-20"
      style={{ background: 'var(--card)', backdropFilter: 'blur(12px)' }}
    >
      {isPen && (
        <>
          {/* Color presets */}
          <div className="flex items-center gap-1.5">
            {PRESET_COLORS.map(c => (
              <button
                key={c.value}
                title={c.label}
                onClick={() => setPenColor(c.value)}
                className="rounded-full transition-transform hover:scale-110 focus:outline-none"
                style={{
                  width: 20,
                  height: 20,
                  background: c.value,
                  border: penColor === c.value
                    ? '2.5px solid #3b82f6'
                    : c.value === '#ffffff'
                    ? '1.5px solid #d1d5db'
                    : '1.5px solid transparent',
                  transform: penColor === c.value ? 'scale(1.25)' : undefined,
                  boxShadow: penColor === c.value ? '0 0 0 1px #3b82f6' : undefined
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
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                style={{ width: 20, height: 20 }}
              />
            </label>
          </div>

          <div className="w-px h-6 bg-border" />

          {/* Size presets */}
          <div className="flex items-center gap-2">
            {SIZE_PRESETS.map(s => (
              <button
                key={s}
                title={`${s}px`}
                onClick={() => setPenSize(s)}
                className="rounded-full bg-foreground transition-transform hover:scale-110 focus:outline-none"
                style={{
                  width: Math.min(s, 22),
                  height: Math.min(s, 22),
                  opacity: penSize === s ? 1 : 0.3,
                  transform: penSize === s ? 'scale(1.2)' : undefined,
                  background: penColor,
                  border: penSize === s ? '2px solid #3b82f6' : undefined
                }}
              />
            ))}
          </div>

          <div className="w-px h-6 bg-border" />

          {/* Fine-grained size slider */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Size</span>
            <input
              type="range"
              min={1}
              max={50}
              value={penSize}
              onChange={e => setPenSize(Number(e.target.value))}
              className="w-20 accent-blue-500"
            />
            <span className="text-xs text-muted-foreground w-5">{penSize}</span>
          </div>
        </>
      )}

      {isEraser && (
        <div className="flex items-center gap-2">
          <div
            className="rounded-full border-2 border-muted-foreground/30 bg-white"
            style={{ width: Math.min(eraserSize, 40), height: Math.min(eraserSize, 40) }}
          />
          <span className="text-xs text-muted-foreground">Eraser Size</span>
          <input
            type="range"
            min={5}
            max={80}
            value={eraserSize}
            onChange={e => setEraserSize(Number(e.target.value))}
            className="w-24 accent-blue-500"
          />
          <span className="text-xs text-muted-foreground w-6">{eraserSize}</span>
        </div>
      )}
    </div>
  )
}
