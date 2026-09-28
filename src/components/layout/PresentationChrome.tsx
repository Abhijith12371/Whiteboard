import { useEffect } from 'react'
import { ChevronLeft, ChevronRight, Clock, Crosshair, CircleDot, X } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { useBoardStore } from '../../store/boardStore'

export function PresentationChrome() {
  const isPresenting = useUIStore((s) => s.isPresenting)
  const setPresenting = useUIStore((s) => s.setPresenting)
  const spotlightOn = useUIStore((s) => s.spotlightOn)
  const setSpotlightOn = useUIStore((s) => s.setSpotlightOn)
  const setActiveTool = useUIStore((s) => s.setActiveTool)
  const timerSeconds = useUIStore((s) => s.timerSeconds)
  const timerRunning = useUIStore((s) => s.timerRunning)
  const setTimerSeconds = useUIStore((s) => s.setTimerSeconds)
  const setTimerRunning = useUIStore((s) => s.setTimerRunning)
  const pages = useBoardStore((s) => s.pages)
  const activePageId = useBoardStore((s) => s.activePageId)
  const switchPage = useBoardStore((s) => s.switchPage)

  useEffect(() => {
    if (!isPresenting || !timerRunning) return
    const t = window.setInterval(() => setTimerSeconds(useUIStore.getState().timerSeconds + 1), 1000)
    return () => window.clearInterval(t)
  }, [isPresenting, timerRunning, setTimerSeconds])

  useEffect(() => {
    if (!isPresenting) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return
      if (e.key === 'Escape') setPresenting(false)
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        const i = pages.findIndex((p) => p.id === activePageId)
        if (i >= 0 && i < pages.length - 1) switchPage(pages[i + 1].id)
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        const i = pages.findIndex((p) => p.id === activePageId)
        if (i > 0) switchPage(pages[i - 1].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isPresenting, pages, activePageId, setPresenting, switchPage])

  if (!isPresenting) return null

  const idx = Math.max(0, pages.findIndex((p) => p.id === activePageId))
  const mm = String(Math.floor(timerSeconds / 60)).padStart(2, '0')
  const ss = String(timerSeconds % 60).padStart(2, '0')

  return (
    <div className="absolute bottom-4 left-1/2 z-40 -translate-x-1/2 flex items-center gap-1 rounded-2xl border border-border bg-card/95 px-2 py-1.5 shadow-xl">
      <button aria-label="Previous page" className="p-2 rounded-lg hover:bg-accent" onClick={() => idx > 0 && switchPage(pages[idx - 1].id)}>
        <ChevronLeft size={16} />
      </button>
      <span className="text-xs px-2 min-w-[88px] text-center">{idx + 1} / {pages.length}</span>
      <button aria-label="Next page" className="p-2 rounded-lg hover:bg-accent" onClick={() => idx < pages.length - 1 && switchPage(pages[idx + 1].id)}>
        <ChevronRight size={16} />
      </button>
      <div className="w-px h-5 bg-border mx-1" />
      <button aria-label="Laser pointer" className="p-2 rounded-lg hover:bg-accent" title="Laser Pointer" onClick={() => setActiveTool('laser')}>
        <Crosshair size={16} />
      </button>
      <button aria-label="Spotlight" className={`p-2 rounded-lg hover:bg-accent ${spotlightOn ? 'bg-accent' : ''}`} title="Spotlight" onClick={() => setSpotlightOn(!spotlightOn)}>
        <CircleDot size={16} />
      </button>
      <button aria-label="Timer" className="p-2 rounded-lg hover:bg-accent flex items-center gap-1 text-xs" onClick={() => setTimerRunning(!timerRunning)}>
        <Clock size={14} /> {mm}:{ss}
      </button>
      <button aria-label="Exit presentation" className="p-2 rounded-lg hover:bg-accent" title="Exit presentation" onClick={() => setPresenting(false)}>
        <X size={16} />
      </button>
    </div>
  )
}

export function SpotlightOverlay() {
  const on = useUIStore((s) => s.spotlightOn)
  if (!on) return null
  return (
    <div
      className="pointer-events-none absolute inset-0 z-30"
      style={{
        background: 'radial-gradient(circle 180px at var(--spot-x, 50%) var(--spot-y, 40%), transparent 0%, rgba(0,0,0,0.55) 100%)',
      }}
    />
  )
}
