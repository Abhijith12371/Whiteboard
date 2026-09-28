import { create } from 'zustand'
import type { ShapeKind } from '../lib/assets/shapeCatalog'
import { DARK_INK, inkForSurface, resolveBoardSurface, autoInk, canvasBg, type Theme } from '../lib/colors'
import type { ColorMode } from '../types'
import { DEFAULT_BOARD_ID } from '../services/db'

const THEME_KEY = 'digiboard_theme'
const THEME_VERSION_KEY = 'digiboard_theme_version'

const DEFAULT_THEME: 'light' | 'dark' = 'dark'

/**
 * Bump this whenever the default should be re-applied to everyone on upgrade.
 * Users landing on a new value get the fresh default once; after that their own
 * toggle is respected again.
 */
const THEME_DEFAULT_VERSION = '2'

function initialTheme(): 'light' | 'dark' {
  try {
    const version = localStorage.getItem(THEME_VERSION_KEY)
    if (version !== THEME_DEFAULT_VERSION) {
      // First launch after an update that re-seeds the default: overwrite any
      // stored choice and stamp the version, so toggles work normally from here.
      localStorage.setItem(THEME_KEY, DEFAULT_THEME)
      localStorage.setItem(THEME_VERSION_KEY, THEME_DEFAULT_VERSION)
      return DEFAULT_THEME
    }
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark') return stored
    return DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

const STARTING_THEME = initialTheme()
if (STARTING_THEME === 'dark' && typeof document !== 'undefined') {
  document.documentElement.classList.add('dark')
}

/** Board tint selected on a fresh install. Pairs with the dark default theme. */
const DEFAULT_BOARD_COLOR: BoardColor = 'dark'

// The default board surface and the starting ink must agree, otherwise a dark
// launch would hand the user an invisible black pen.
const STARTING_INK = inkForSurface(DARK_INK, resolveBoardSurface(DEFAULT_BOARD_COLOR, STARTING_THEME).bg)

export type Tool = 'select' | 'pan' | 'pen' | 'pencil' | 'highlighter' | 'eraser' | 'laser' | 'text' | 'sticky' | 'rectangle' | 'circle' | 'triangle' | 'line' | 'arrow' | 'image' | 'shape'
export type BoardBackground = 'dots' | 'ruled' | 'grid' | 'blank'
export type BoardColor = 'white' | 'cream' | 'sky' | 'mint' | 'lavender' | 'dark'
export type RightPanel = 'none' | 'properties' | 'pages' | 'layers' | 'templates' | 'ai'
export type LibraryPanel = 'none' | 'shapes' | 'icons' | 'stickers' | 'media' | 'more'

/** Local-only persistence status, surfaced in the header. */
export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface UIState {
  activeTool: Tool;
  shapeKind: ShapeKind;
  isSpacePressed: boolean;
  theme: 'light' | 'dark';
  selectedIds: string[];

  penColor: string;
  penSize: number;
  penOpacity: number;
  eraserSize: number;

  boardBackground: BoardBackground;
  boardColor: BoardColor;

  activeBoardId: string;
  activeBoardName: string;
  isHomeOpen: boolean;
  rightPanel: RightPanel;
  libraryPanel: LibraryPanel;
  isCommandPaletteOpen: boolean;
  isShortcutsOpen: boolean;
  isPresenting: boolean;
  spotlightOn: boolean;
  timerSeconds: number;
  timerRunning: boolean;
  clipboard: any[];
  toast: string | null;
  saveState: SaveState;

  setActiveTool: (tool: Tool) => void;
  setShapeKind: (kind: ShapeKind) => void;
  setSpacePressed: (pressed: boolean) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setSelectedIds: (ids: string[]) => void;
  setPenColor: (color: string) => void;
  penColorMode: ColorMode;
  setPenColorMode: (mode: ColorMode) => void;
  setPenSize: (size: number) => void;
  setPenOpacity: (opacity: number) => void;
  setEraserSize: (size: number) => void;
  setBoardBackground: (bg: BoardBackground) => void;
  setBoardColor: (color: BoardColor) => void;
  setActiveBoard: (id: string, name: string) => void;
  setHomeOpen: (isOpen: boolean) => void;
  setRightPanel: (panel: RightPanel) => void;
  setLibraryPanel: (panel: LibraryPanel) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setPresenting: (on: boolean) => void;
  setSpotlightOn: (on: boolean) => void;
  setTimerSeconds: (n: number) => void;
  setTimerRunning: (on: boolean) => void;
  setClipboard: (clipboard: any[]) => void;
  setToast: (msg: string | null) => void;
  setSaveState: (state: SaveState) => void;
  setLayersPanelOpen: (isOpen: boolean) => void;
  isLayersPanelOpen: boolean;
}

export const useUIStore = create<UIState>((set, get) => {
  // Keep the *active* pen colour readable when the board surface changes, but
  // only ever by resolving an "auto" pen. A deliberately-chosen colour is never
  // reassigned, and auto ink needs no mutation at all — it resolves per render.
  const guardInk = (bg: string) => {
    if (get().penColorMode === 'auto') {
      set({ penColor: autoInk(get().theme as Theme) })
      return
    }
    const current = get().penColor
    const adjusted = inkForSurface(current, bg)
    if (adjusted === current) return
    const message = 'Ink colour updated to stay visible on this background'
    set({ penColor: adjusted, toast: message })
    window.setTimeout(() => {
      if (get().toast === message) set({ toast: null })
    }, 2600)
  }

  return {
  activeTool: 'select',
  shapeKind: 'rectangle',
  isSpacePressed: false,
  theme: STARTING_THEME,
  selectedIds: [],

  penColor: STARTING_INK,
  penColorMode: 'auto' as ColorMode,
  penSize: 3,
  penOpacity: 1,
  eraserSize: 20,

  boardBackground: 'blank',
  boardColor: DEFAULT_BOARD_COLOR,

  activeBoardId: DEFAULT_BOARD_ID,
  activeBoardName: 'Whiteboard',
  isHomeOpen: false,
  rightPanel: 'none',
  libraryPanel: 'none',
  isCommandPaletteOpen: false,
  isShortcutsOpen: false,
  isPresenting: false,
  spotlightOn: false,
  timerSeconds: 0,
  timerRunning: false,
  clipboard: [],
  toast: null,
  saveState: 'idle',
  isLayersPanelOpen: false,

  setActiveTool: (tool) => set({ activeTool: tool }),
  setShapeKind: (shapeKind) => set({ shapeKind }),
  setSpacePressed: (pressed) => set({ isSpacePressed: pressed }),
  setTheme: (theme) => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try { localStorage.setItem(THEME_KEY, theme) } catch { /* ignore */ }
    set({ theme })
    // An auto pen simply follows the theme from here; no stored data changes.
    // Custom strokes resolve their own literal colour at render time, so there
    // is deliberately nothing to restyle here any more.
    if (get().penColorMode === 'auto') {
      set({ penColor: autoInk(theme as Theme) })
    } else {
      guardInk(canvasBg(theme as Theme))
    }
  },
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  setPenColor: (penColor) => set({ penColor, penColorMode: 'custom' }),
  setPenColorMode: (mode) => set({
    penColorMode: mode,
    penColor: mode === 'auto' ? autoInk(get().theme as Theme) : get().penColor,
  }),
  setPenSize: (penSize) => set({ penSize }),
  setPenOpacity: (penOpacity) => set({ penOpacity }),
  setEraserSize: (eraserSize) => set({ eraserSize }),
  setBoardBackground: (boardBackground) => set({ boardBackground }),
  setBoardColor: (boardColor) => {
    set({ boardColor })
    guardInk(resolveBoardSurface(boardColor, get().theme).bg)
  },
  setActiveBoard: (id, name) => set({ activeBoardId: id, activeBoardName: name }),
  setHomeOpen: (isOpen) => set({ isHomeOpen: isOpen }),
  setRightPanel: (rightPanel) => set({ rightPanel, isLayersPanelOpen: rightPanel === 'layers' }),
  setLibraryPanel: (libraryPanel) => set({ libraryPanel }),
  setCommandPaletteOpen: (isCommandPaletteOpen) => set({ isCommandPaletteOpen }),
  setShortcutsOpen: (isShortcutsOpen) => set({ isShortcutsOpen }),
  setPresenting: (isPresenting) => set({ isPresenting, libraryPanel: 'none' }),
  setSpotlightOn: (spotlightOn) => set({ spotlightOn }),
  setTimerSeconds: (timerSeconds) => set({ timerSeconds }),
  setTimerRunning: (timerRunning) => set({ timerRunning }),
  setClipboard: (clipboard) => set({ clipboard }),
  setToast: (toast) => set({ toast }),
  setSaveState: (saveState) => set({ saveState }),
  setLayersPanelOpen: (isOpen) => set({
    isLayersPanelOpen: isOpen,
    rightPanel: isOpen ? 'layers' : 'none',
  }),
  }
})
