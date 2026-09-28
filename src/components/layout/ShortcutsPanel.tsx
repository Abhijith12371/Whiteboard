import { useUIStore } from '../../store/uiStore'

const GROUPS: { title: string; items: { keys: string; action: string }[] }[] = [
  {
    title: 'Tools',
    items: [
      { keys: 'V', action: 'Select' },
      { keys: 'H', action: 'Hand / Pan' },
      { keys: 'P', action: 'Pen' },
      { keys: 'E', action: 'Eraser' },
      { keys: 'T', action: 'Text' },
      { keys: 'N', action: 'Sticky note' },
      { keys: 'S', action: 'Shapes library' },
      { keys: 'A', action: 'Arrow' },
      { keys: 'L', action: 'Line' },
      { keys: 'Space + drag', action: 'Pan canvas' },
    ],
  },
  {
    title: 'Edit',
    items: [
      { keys: 'Ctrl+Z', action: 'Undo' },
      { keys: 'Ctrl+Shift+Z', action: 'Redo' },
      { keys: 'Ctrl+C', action: 'Copy' },
      { keys: 'Ctrl+X', action: 'Cut' },
      { keys: 'Ctrl+V', action: 'Paste' },
      { keys: 'Ctrl+D', action: 'Duplicate' },
      { keys: 'Delete', action: 'Delete' },
      { keys: 'Ctrl+A', action: 'Select all' },
      { keys: 'Ctrl+G', action: 'Group' },
      { keys: 'Ctrl+Shift+G', action: 'Ungroup' },
    ],
  },
  {
    title: 'Workspace',
    items: [
      { keys: 'Ctrl+K', action: 'Command palette' },
      { keys: 'Ctrl+S', action: 'Save (auto-save always on)' },
      { keys: '?', action: 'This shortcuts panel' },
      { keys: 'Esc', action: 'Exit presentation / close panels' },
    ],
  },
]

export function ShortcutsPanel() {
  const open = useUIStore((s) => s.isShortcutsOpen)
  const setOpen = useUIStore((s) => s.setShortcutsOpen)
  if (!open) return null

  const replayIntro = () => {
    localStorage.removeItem('digiboard_intro_done')
    window.location.reload()
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-scrim/30" onClick={() => setOpen(false)}>
      <div
        className="w-[min(640px,94vw)] max-h-[80vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Keyboard shortcuts"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Keyboard shortcuts</h2>
          <button className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setOpen(false)}>Close</button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Shortcuts speed you up. Every action here is also available from the toolbar, menus, or Ctrl+K.
        </p>
        <div className="mb-4 pb-4 border-b border-border">
          <button 
            onClick={replayIntro}
            className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            Replay Intro Animation
          </button>
        </div>
        <div className="grid sm:grid-cols-2 gap-6">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{g.title}</h3>
              <ul className="space-y-1.5">
                {g.items.map((item) => (
                  <li key={item.keys} className="flex items-center justify-between text-sm gap-3">
                    <span>{item.action}</span>
                    <kbd className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[11px]">{item.keys}</kbd>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
