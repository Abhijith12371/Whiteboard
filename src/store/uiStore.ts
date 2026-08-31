import { create } from 'zustand'

export type Tool = 'select' | 'pan' | 'pen' | 'eraser' | 'text' | 'sticky' | 'rectangle' | 'circle' | 'triangle' | 'line' | 'arrow' | 'image'

interface UIState {
  activeTool: Tool;
  isSpacePressed: boolean;
  theme: 'light' | 'dark';
  selectedIds: string[];
  
  setActiveTool: (tool: Tool) => void;
  setSpacePressed: (pressed: boolean) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setSelectedIds: (ids: string[]) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeTool: 'select',
  isSpacePressed: false,
  theme: 'light',
  selectedIds: [],
  
  setActiveTool: (tool) => set({ activeTool: tool }),
  setSpacePressed: (pressed) => set({ isSpacePressed: pressed }),
  setTheme: (theme) => set({ theme }),
  setSelectedIds: (ids) => set({ selectedIds: ids }),
}))
