/** True when running inside the Electron shell (the preload bridge is present). */
export const isElectron: boolean =
  typeof window !== 'undefined' && typeof (window as any).ipcRenderer !== 'undefined'

/**
 * Width reserved for the Windows caption buttons drawn by
 * `titleBarOverlay` (minimize / maximize / close). Windows lays these out at
 * 46px each, so 138px covers all three; a little slack absorbs DPI rounding.
 */
export const CAPTION_BUTTON_WIDTH = 140
