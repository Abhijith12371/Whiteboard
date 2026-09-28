import { useState } from 'react'
import { Settings2, X } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import type { BoardBackground, BoardColor } from '../../store/uiStore'
import { resolveBoardSurface } from '../../lib/colors'

const BACKGROUNDS: { id: BoardBackground; label: string; icon: string }[] = [
  { id: 'blank', label: 'Blank', icon: '□' },
  { id: 'dots', label: 'Dots', icon: '⠿' },
  { id: 'ruled', label: 'Ruled', icon: '≡' },
  { id: 'grid', label: 'Grid', icon: '#' },
]

const BOARD_COLORS: { id: BoardColor; label: string }[] = [
  { id: 'white', label: 'White' },
  { id: 'cream', label: 'Cream' },
  { id: 'sky', label: 'Sky' },
  { id: 'mint', label: 'Mint' },
  { id: 'lavender', label: 'Lavender' },
  { id: 'dark', label: 'Dark' },
]

export const BoardSettingsPanel = () => {
  const [open, setOpen] = useState(false)
  const boardBackground = useUIStore(s => s.boardBackground)
  const boardColor = useUIStore(s => s.boardColor)
  const theme = useUIStore(s => s.theme)
  const setBoardBackground = useUIStore(s => s.setBoardBackground)
  const setBoardColor = useUIStore(s => s.setBoardColor)

  const [playIntro, setPlayIntro] = useState(() => {
    return localStorage.getItem('digiboard_intro_done') !== 'true'
  })

  const togglePlayIntro = () => {
    const newVal = !playIntro
    setPlayIntro(newVal)
    if (!newVal) {
      localStorage.setItem('digiboard_intro_done', 'true')
    } else {
      localStorage.removeItem('digiboard_intro_done')
    }
  }

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
                        ? 'border-ring bg-accent'
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
                {BOARD_COLORS.map(color => {
                  const surface = resolveBoardSurface(color.id, theme)
                  return (
                    <button
                      key={color.id}
                      onClick={() => setBoardColor(color.id)}
                      title={`${color.label} (${theme})`}
                      aria-label={`${color.label} board`}
                      className="rounded-lg transition-transform hover:scale-105"
                      style={{
                        width: 36,
                        height: 36,
                        background: surface.bg,
                        backgroundImage: boardBackground === 'dots'
                          ? `radial-gradient(circle, ${surface.dot} 1.2px, transparent 1.2px)`
                          : undefined,
                        backgroundSize: '8px 8px',
                        border: boardColor === color.id
                          ? '2.5px solid var(--ring)'
                          : '1.5px solid var(--border)',
                        boxShadow: boardColor === color.id ? '0 0 0 1px var(--ring)' : undefined
                      }}
                    />
                  )
                })}
              </div>
            </div>

            {/* App Settings */}
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">App Settings</p>
              <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-foreground/80 transition-colors">
                <input 
                  type="checkbox" 
                  checked={playIntro} 
                  onChange={togglePlayIntro}
                  className="rounded border-border accent-primary focus:ring-ring"
                />
                Play intro animation on startup
              </label>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
