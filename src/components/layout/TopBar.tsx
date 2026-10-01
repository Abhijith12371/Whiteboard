import { useState, type CSSProperties } from 'react'
import { Home, Presentation, Keyboard, Undo2, Redo2, Download, Upload, PanelRight, LayoutTemplate, Layers, FileStack, Command, Sun, Moon, Share2, Eye } from 'lucide-react'
import { useBoardStore } from '../../store/boardStore'
import { useUIStore } from '../../store/uiStore'
import { BoardSettingsPanel } from './BoardSettingsPanel'
import { isElectron, CAPTION_BUTTON_WIDTH } from '../../lib/env'
import { SyncStatus } from './SyncStatus'
import { exportJSON, exportStageImage, exportSVG, importJSONFile } from '../../lib/workspaceActions'
import { ToolbarTip } from '../ui/ToolbarTip'
import { AccountMenu } from '../auth/AccountMenu'
import { BoardNameDialog } from './BoardNameDialog'

export const TopBar = () => {
  const activeBoardId = useUIStore((s) => s.activeBoardId)
  const activeBoardName = useUIStore((s) => s.activeBoardName)
  const setActiveBoard = useUIStore((s) => s.setActiveBoard)
  const setHomeOpen = useUIStore((s) => s.setHomeOpen)
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen)
  const setPresenting = useUIStore((s) => s.setPresenting)
  const setRightPanel = useUIStore((s) => s.setRightPanel)
  const rightPanel = useUIStore((s) => s.rightPanel)
  const setShortcutsOpen = useUIStore((s) => s.setShortcutsOpen)
  const isPresenting = useUIStore((s) => s.isPresenting)
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)
  const undo = useBoardStore((s) => s.undo)
  const redo = useBoardStore((s) => s.redo)

  const [editingTitle, setEditingTitle] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const boardRole = useUIStore((state) => state.boardRole)
  const setShareOpen = useUIStore((state) => state.setShareOpen)

  // Renaming goes through the same dialog as creation, so a board cannot be
  // renamed into a duplicate name after the fact.
  const handleTitleSubmit = (newTitle: string) => {
    setActiveBoard(activeBoardId, newTitle)
    setEditingTitle(false)
  }

  const togglePanel = (panel: typeof rightPanel) => {
    setRightPanel(rightPanel === panel ? 'none' : panel)
  }

  if (isPresenting) return <div className="h-0" />

  return (
    <>
    <div
      className="h-14 border-b border-border flex items-center justify-between px-4 z-10 shrink-0 bg-gradient-to-b from-card to-card/95"
      style={{ WebkitAppRegion: 'drag' } as CSSProperties}
    >
      {/* Left Section: Navigation & Title */}
      <div className="flex items-center gap-3 min-w-0 flex-1" style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}>
        <ToolbarTip label="All Boards" shortcut="">
          <button onClick={() => setHomeOpen(true)} className="p-2 hover:bg-accent/50 rounded-lg text-muted-foreground hover:text-foreground transition-colors" aria-label="Home">
            <Home size={18} />
          </button>
        </ToolbarTip>
        
        <div className="w-px h-6 bg-border/40" />
        
        {/* Theme — lives in the left cluster so the native caption buttons on
            the far right can never cover it. */}
        <ToolbarTip label={theme === 'dark' ? 'Light theme' : 'Dark theme'}>
          <button
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 hover:bg-accent/50 rounded-lg text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </ToolbarTip>
        
        <div className="w-px h-6 bg-border/40" />
        
        {/* Board Title */}
        <div className="flex items-center gap-2 min-w-0 flex-1 max-w-xs">
          <button onClick={() => setEditingTitle(true)} className="font-semibold text-sm px-3 py-1.5 hover:bg-accent/50 rounded-lg truncate transition-colors">
            {activeBoardName}
          </button>
          <SyncStatus />
        </div>

        {/* Undo/Redo */}
        <div className="flex items-center gap-1 ml-2">
          <ToolbarTip label="Undo" shortcut="Ctrl+Z">
            <button aria-label="Undo" onClick={undo} className="p-2 hover:bg-accent/50 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
              <Undo2 size={16} />
            </button>
          </ToolbarTip>
          <ToolbarTip label="Redo" shortcut="Ctrl+Shift+Z">
            <button aria-label="Redo" onClick={redo} className="p-2 hover:bg-accent/50 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
              <Redo2 size={16} />
            </button>
          </ToolbarTip>
        </div>
      </div>

      {/* Right Section: Tools & Actions */}
      <div className="flex items-center gap-2 shrink-0" style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}>
        {/* Command Palette */}
        <ToolbarTip label="Command Palette" shortcut="Ctrl+K">
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-accent/30 hover:bg-accent/50 rounded-lg border border-border/50 transition-all shrink-0"
          >
            <Command size={13} /> <span className="hidden lg:inline">Cmd+K</span>
          </button>
        </ToolbarTip>

        <div className="w-px h-6 bg-border/40 mx-1" />

        {/* Right Panels */}
        <ToolbarTip label="Pages">
          <button aria-label="Pages" onClick={() => togglePanel('pages')} className={`p-2 rounded-lg transition-colors ${rightPanel === 'pages' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50'}`}>
            <FileStack size={16} />
          </button>
        </ToolbarTip>
        <ToolbarTip label="Layers">
          <button aria-label="Layers" onClick={() => togglePanel('layers')} className={`p-2 rounded-lg transition-colors ${rightPanel === 'layers' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50'}`}>
            <Layers size={16} />
          </button>
        </ToolbarTip>
        <ToolbarTip label="Properties">
          <button aria-label="Properties" onClick={() => togglePanel('properties')} className={`p-2 rounded-lg transition-colors ${rightPanel === 'properties' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50'}`}>
            <PanelRight size={16} />
          </button>
        </ToolbarTip>
        <ToolbarTip label="Templates">
          <button aria-label="Templates" onClick={() => togglePanel('templates')} className={`p-2 rounded-lg transition-colors ${rightPanel === 'templates' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50'}`}>
            <LayoutTemplate size={16} />
          </button>
        </ToolbarTip>

        <div className="w-px h-6 bg-border/40 mx-1" />

        {/* Board Settings */}
        <BoardSettingsPanel />

        {/* Export Menu */}
        <div className="relative">
          <ToolbarTip label="Import / Export">
            <button aria-label="Export" onClick={() => setExportOpen((v) => !v)} className="p-2 hover:bg-accent/50 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
              <Download size={16} />
            </button>
          </ToolbarTip>
          {exportOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setExportOpen(false)} />
              <div className="absolute right-0 top-full mt-2 z-40 w-48 rounded-xl border border-border bg-card shadow-2xl p-1.5 text-sm">
                <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-accent transition-colors flex items-center gap-2" onClick={() => { importJSONFile(); setExportOpen(false) }}>
                  <Upload size={14} />Import JSON
                </button>
                <div className="my-1 h-px bg-border/30" />
                <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-accent transition-colors" onClick={() => { exportStageImage('png'); setExportOpen(false) }}>Export PNG</button>
                <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-accent transition-colors" onClick={() => { exportStageImage('jpeg'); setExportOpen(false) }}>Export JPG</button>
                <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-accent transition-colors" onClick={() => { exportSVG(); setExportOpen(false) }}>Export SVG</button>
                <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-accent transition-colors" onClick={() => { exportJSON(); setExportOpen(false) }}>Export JSON</button>
              </div>
            </>
          )}
        </div>

        {/* Present */}
        <ToolbarTip label="Present" shortcut="">
          <button onClick={() => setPresenting(true)} className="flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 rounded-lg transition-all shadow-sm hover:shadow-md shrink-0">
            <Presentation size={15} /> <span className="hidden md:inline">Present</span>
          </button>
        </ToolbarTip>

        {/* Help */}
        <ToolbarTip label="Keyboard shortcuts" shortcut="?">
          <button aria-label="Keyboard shortcuts" onClick={() => setShortcutsOpen(true)} className="p-2 hover:bg-accent/50 rounded-lg text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <Keyboard size={16} />
          </button>
        </ToolbarTip>

        {/* Sharing is owner-only; a member opening the dialog would just see an
            empty, non-functional panel because RLS rejects every read. */}
        {boardRole === 'owner' && (
          <ToolbarTip label="Share this board" shortcut="">
            <button
              aria-label="Share this board"
              onClick={() => setShareOpen(true)}
              className="p-2 hover:bg-accent/50 rounded-lg text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <Share2 size={16} />
            </button>
          </ToolbarTip>
        )}

        {boardRole === 'viewer' && (
          <span
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-muted text-xs font-medium text-muted-foreground border border-border shrink-0"
            title="You have view-only access to this shared board"
          >
            <Eye size={12} />
            <span className="hidden sm:inline">View only</span>
          </span>
        )}

        <div className="w-px h-6 bg-border/40 mx-1" />

        {/* Account Menu */}
        <AccountMenu />

        {/* Reserve the strip the Windows caption buttons are drawn into, so
            nothing in the action cluster can sit underneath them. */}
        {isElectron && (
          <div aria-hidden="true" style={{ width: CAPTION_BUTTON_WIDTH, flex: '0 0 auto' }} />
        )}
      </div>
    </div>

    {editingTitle && (
      <BoardNameDialog
        initialValue={activeBoardName}
        ignoreId={activeBoardId}
        title="Rename board"
        submitLabel="Save name"
        onCancel={() => setEditingTitle(false)}
        onSubmit={handleTitleSubmit}
      />
    )}
    </>
  )
}
