import { useState } from 'react'
import { Settings2, X } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import type { BoardBackground, BoardColor } from '../../store/uiStore'

const BACKGROUNDS: { id: BoardBackground; label: string; icon: string }[] = [
  { id: 'blank', label: 'Blank', icon: '□' },
  { id: 'dots', label: 'Dots', icon: '⠿' },
  { id: 'ruled', label: 'Ruled', icon: '≡' },
  { id: 'grid', label: 'Grid', icon: '#' },
]

const BOARD_COLORS: { id: BoardColor; label: string; hex: string }[] = [
  { id: 'white', label: 'White', hex: '#ffffff' },
  { id: 'cream', label: 'Cream', hex: '#fefce8' },
  { id: 'sky', label: 'Sky', hex: '#f0f9ff' },
  { id: 'mint', label: 'Mint', hex: '#f0fdf4' },
  { id: 'lavender', label: 'Lavender', hex: '#faf5ff' },
  { id: 'dark', label: 'Dark', hex: '#18181b' },
]

export const BoardSettingsPanel = () => {
  const [open, setOpen] = useState(false)
  const boardBackground = useUIStore(s => s.boardBackground)
  const boardColor = useUIStore(s => s.boardColor)
  const setBoardBackground = useUIStore(s => s.setBoardBackground)
  const setBoardColor = useUIStore(s => s.setBoardColor)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium hover:bg-accent rounded-md transition-colors"
        title="Board Settings"
      >
        <Settings2 size={15} />
        <span>Board</span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />

          {/* Panel */}
          <div
            className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-border shadow-2xl z-40 p-4"
            style={{ background: 'var(--card)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">Board Settings</h3>
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-accent rounded">
                <X size={14} />
              </button>
            </div>

            {/* Background pattern */}
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Pattern</p>
              <div className="grid grid-cols-4 gap-2">
                {BACKGROUNDS.map(bg => (
                  <button
                    key={bg.id}
                    onClick={() => setBoardBackground(bg.id)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all ${
                      boardBackground === bg.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-border hover:border-muted-foreground/50'
                    }`}
                  >
                    <span className="text-lg font-mono leading-none">{bg.icon}</span>
                    <span className="text-xs text-muted-foreground">{bg.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Background color */}
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Color</p>
              <div className="grid grid-cols-6 gap-2">
                {BOARD_COLORS.map(color => (
                  <button
                    key={color.id}
                    onClick={() => setBoardColor(color.id)}
                    title={color.label}
                    className="rounded-lg transition-transform hover:scale-105"
                    style={{
                      width: 36,
                      height: 36,
                      background: color.hex,
                      border: boardColor === color.id
                        ? '2.5px solid #3b82f6'
                        : '1.5px solid #d1d5db',
                      boxShadow: boardColor === color.id ? '0 0 0 1px #3b82f6' : undefined
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
