import { app, BrowserWindow, ipcMain, clipboard } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

// Fix quota database / disk cache errors on Windows
app.commandLine.appendSwitch('disable-gpu-sandbox')
app.commandLine.appendSwitch('no-sandbox')
app.commandLine.appendSwitch('disable-web-security') // allow IDB in local files
app.commandLine.appendSwitch('disable-http-cache')
app.commandLine.appendSwitch('disk-cache-size', '0')
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
app.commandLine.appendSwitch('media-cache-size', '0')

let win: BrowserWindow | null

// ─── Deep links ──────────────────────────────────────────────────────────────
// Password-reset and OAuth emails redirect to `digiboard://…`, because the app
// runs from a file:// origin that Supabase cannot redirect back to. On Windows
// the link arrives via a second launch, so the pending URL is stashed until the
// renderer is ready to consume it.

const DEEP_LINK_SCHEME = 'digiboard'
let pendingDeepLink: string | null = null

if (process.defaultApp && process.argv.length >= 2) {
  // Dev build: the executable is electron itself, so the app path must be
  // registered too or Windows will not route the scheme back to us.
  //
  // The path must be absolute. Windows launches the protocol handler with an
  // unrelated working directory (C:\Windows\System32), so a relative path such
  // as "." resolves against that and Electron reports
  // "Unable to find Electron app at C:\WINDOWS\system32".
  app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME, process.execPath, [
    path.resolve(process.argv[1]),
  ])
} else {
  app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME)
}

function deepLinkFrom(argv: string[]): string | null {
  return argv.find((arg) => arg.startsWith(`${DEEP_LINK_SCHEME}://`)) ?? null
}

function deliverDeepLink(url: string) {
  if (win && !win.isDestroyed() && win.webContents && !win.webContents.isLoading()) {
    win.webContents.send('deep-link', url)
  } else {
    pendingDeepLink = url
  }
}

// macOS delivers the URL through open-url.
app.on('open-url', (event, url) => {
  event.preventDefault()
  deliverDeepLink(url)
})

// Windows/Linux relaunch the app with the URL in argv.
const existing = deepLinkFrom(process.argv)
if (existing) pendingDeepLink = existing

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const url = deepLinkFrom(argv)
    if (url) deliverDeepLink(url)
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
}

// The preload is emitted as CommonJS (see vite.config.ts) and must use a
// `.cjs` extension because package.json declares "type": "module". The `.mjs`
// and `.js` names are still accepted so a stale build does not break launch.
function resolvePreload(): string {
  const candidates = ['preload.cjs', 'preload.mjs', 'preload.js']
  for (const name of candidates) {
    const p = path.join(__dirname, name)
    if (fs.existsSync(p)) return p
  }
  throw new Error(
    `Electron preload script not found in ${__dirname} (looked for ${candidates.join(', ')})`,
  )
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#ffffff',
      symbolColor: '#09090b',
      height: 40,
    },
    webPreferences: {
      preload: resolvePreload(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // needed to allow IndexedDB / quota DB on Windows
    },
  })

  // Open DevTools in dev for debugging
  if (VITE_DEV_SERVER_URL) {
    win.webContents.openDevTools({ mode: 'detach' })
  }

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
    // A link that arrived before the renderer could listen is delivered now.
    if (pendingDeepLink) {
      win?.webContents.send('deep-link', pendingDeepLink)
      pendingDeepLink = null
    }
  })

  // Let the renderer repaint the native caption buttons when the theme changes,
  // otherwise they keep the startup colours and clash in dark mode.
  ipcMain.on('set-titlebar-overlay', (_event, options: { color: string; symbolColor: string }) => {
    if (!win || win.isDestroyed()) return
    try {
      win.setTitleBarOverlay({ color: options.color, symbolColor: options.symbolColor, height: 40 })
    } catch {
      // Overlay unsupported (e.g. non-Windows) — safe to ignore.
    }
  })

  // Share links are copied through Electron's clipboard: the renderer's
  // navigator.clipboard is rejected unless the document holds focus, so a
  // button promising "Create & copy" would silently fail to copy.
  ipcMain.handle('clipboard-write', (_event, text: unknown) => {
    if (typeof text !== 'string' || !text) return false
    try {
      clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// ─── Filesystem board persistence ─────────────────────────────────────────────
// Saves board data as plain JSON files in the app's userData directory.
// This completely bypasses IndexedDB / quota-database which can fail on Windows.

function boardsDir(): string {
  const dir = path.join(app.getPath('userData'), 'boards')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function boardFile(id: string): string {
  return path.join(boardsDir(), `${id}.json`)
}

ipcMain.handle('fs-save-board', (_event, payload: { id: string; data: any }) => {
  try {
    fs.writeFileSync(boardFile(payload.id), JSON.stringify(payload.data), 'utf-8')
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: String(err) }
  }
})

ipcMain.handle('fs-load-board', (_event, id: string) => {
  try {
    const file = boardFile(id)
    if (!fs.existsSync(file)) return { ok: true, data: null }
    const raw = fs.readFileSync(file, 'utf-8')
    return { ok: true, data: JSON.parse(raw) }
  } catch (err: any) {
    return { ok: false, error: String(err) }
  }
})

ipcMain.handle('fs-list-boards', () => {
  try {
    const dir = boardsDir()
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'))
    const boards = files
      .map(f => {
        try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) } catch { return null }
      })
      .filter(Boolean)
      .sort((a: any, b: any) => (a.updatedAt || 0) - (b.updatedAt || 0))
    return { ok: true, data: boards }
  } catch (err: any) {
    return { ok: false, error: String(err) }
  }
})

ipcMain.handle('fs-delete-board', (_event, id: string) => {
  try {
    const file = boardFile(id)
    if (fs.existsSync(file)) fs.unlinkSync(file)
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: String(err) }
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)
