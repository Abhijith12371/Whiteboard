import { create } from 'zustand'

export type Tool = 'select' | 'pan' | 'pen' | 'eraser' | 'text' | 'sticky' | 'rectangle' | 'circle' | 'triangle' | 'line' | 'arrow' | 'image'
export type BoardBackground = 'dots' | 'ruled' | 'grid' | 'blank'
export type BoardColor = 'white' | 'cream' | 'sky' | 'mint' | 'lavender' | 'dark'

interface UIState {
  activeTool: Tool;
  isSpacePressed: boolean;
  theme: 'light' | 'dark';
  selectedIds: string[];

  // Pen settings
  penColor: string;
  penSize: number;
  eraserSize: number;

  // Board settings
  boardBackground: BoardBackground;
  boardColor: BoardColor;

  // Board Management
  activeBoardId: string;
  activeBoardName: string;
  isHomeOpen: boolean;
  isLayersPanelOpen: boolean;
  clipboard: any[];

  setActiveTool: (tool: Tool) => void;
  setSpacePressed: (pressed: boolean) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setSelectedIds: (ids: string[]) => void;
  setPenColor: (color: string) => void;
  setPenSize: (size: number) => void;
  setEraserSize: (size: number) => void;
  setBoardBackground: (bg: BoardBackground) => void;
  setBoardColor: (color: BoardColor) => void;
  
  setActiveBoard: (id: string, name: string) => void;
  setHomeOpen: (isOpen: boolean) => void;
  setLayersPanelOpen: (isOpen: boolean) => void;
  setClipboard: (clipboard: any[]) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeTool: 'select',
  isSpacePressed: false,
  theme: 'light',
  selectedIds: [],

  penColor: '#09090b',
  penSize: 3,
  eraserSize: 20,

  boardBackground: 'dots',
  boardColor: 'white',

  activeBoardId: 'default-board-id',
  activeBoardName: 'Whiteboard',
  isHomeOpen: false,
  isLayersPanelOpen: false,
  clipboard: [],

  setActiveTool: (tool) => set({ activeTool: tool }),
  setSpacePressed: (pressed) => set({ isSpacePressed: pressed }),
  setTheme: (theme) => set({ theme }),
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  setPenColor: (penColor) => set({ penColor }),
  setPenSize: (penSize) => set({ penSize }),
  setEraserSize: (eraserSize) => set({ eraserSize }),
  setBoardBackground: (boardBackground) => set({ boardBackground }),
  setBoardColor: (boardColor) => set({ boardColor }),
  
  setActiveBoard: (id, name) => set({ activeBoardId: id, activeBoardName: name }),
  setHomeOpen: (isOpen) => set({ isHomeOpen: isOpen }),
  setLayersPanelOpen: (isOpen) => set({ isLayersPanelOpen: isOpen }),
  setClipboard: (clipboard) => set({ clipboard }),
}))
