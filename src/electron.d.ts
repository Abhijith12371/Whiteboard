/// <reference types="vite/client" />

// Electron preload bridge types
interface Window {
  /**
   * Repaints the native Windows caption buttons so they match the active theme.
   */
  __electron_setTitleBarOverlay?: (options: { color: string; symbolColor: string }) => void
}
