# Digiboard — Complete Technical Explanation

A comprehensive reference covering every aspect of this app: how it was built, how the codebase is structured, how it is packaged into an APPX, and how it is published on the Microsoft Store.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Repository Structure](#3-repository-structure)
4. [Architecture Overview](#4-architecture-overview)
5. [The Electron Shell](#5-the-electron-shell)
6. [The React Frontend (Renderer Process)](#6-the-react-frontend-renderer-process)
7. [The Canvas Engine (Konva + react-konva)](#7-the-canvas-engine-konva--react-konva)
8. [Build System (Vite + vite-plugin-electron)](#8-build-system-vite--vite-plugin-electron)
9. [Packaging to APPX (electron-builder)](#9-packaging-to-appx-electron-builder)
10. [APPX Package Internals](#10-appx-package-internals)
11. [Publishing to the Microsoft Store (Partner Center)](#11-publishing-to-the-microsoft-store-partner-center)
12. [Data Flow Diagram](#12-data-flow-diagram)
13. [Keyboard Shortcuts Reference](#13-keyboard-shortcuts-reference)
14. [Known Platform Quirks & Fixes Applied](#14-known-platform-quirks--fixes-applied)

---

## 1. Project Overview

**Digiboard** (marketed as *Whiteboard*) is a desktop whiteboard application built with Electron + React. It clones the core experience of Microsoft Whiteboard: an infinite canvas where users can draw, annotate, add shapes, sticky notes, text, and images — all saved locally and persistable across sessions.

- **Version:** 1.0.3
- **App ID:** `com.digiboard.app`
- **Publisher:** Abhijith N (`AbhijithN.Digiboard`)
- **Platform:** Windows 10/11 (x64, via Electron)
- **Distribution:** Microsoft Store (APPX format) + standalone NSIS installer + portable EXE

---

## 2. Technology Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Desktop shell | Electron | ^44.0.0 | Native window, OS integration |
| UI framework | React | ^19.2.8 | Component tree, rendering |
| Language | TypeScript | ~6.0.2 | Type-safe development |
| Canvas rendering | Konva / react-konva | ^10.3.2 / ^19.2.5 | Hardware-accelerated 2D canvas |
| State management | Zustand | ^5.0.15 | Lightweight, hook-based global state |
| Local persistence | idb (IndexedDB wrapper) | ^8.0.3 | Board data stored on-device |
| Styling | Tailwind CSS v4 | ^4.3.3 | Utility-first CSS |
| Icons | lucide-react | ^1.37.0 | SVG icon library |
| Build bundler | Vite | ^8.2.2 | Lightning-fast ESM dev server + build |
| Electron integration | vite-plugin-electron | ^1.1.1 | Bundles main/preload alongside Vite |
| Desktop packaging | electron-builder | ^26.15.3 | Creates NSIS, portable, APPX outputs |
| Linter | oxlint | ^1.79.0 | Fast Rust-based linter |

---

## 3. Repository Structure

```
MicrosoftWhiteboardClone/
|
+-- electron/                  <- Electron main process source (TypeScript)
|   +-- main.ts                <- Creates BrowserWindow, sets up app lifecycle
|   +-- preload.ts             <- Exposes safe IPC bridge to renderer via contextBridge
|
+-- src/                       <- React renderer process source
|   +-- main.tsx               <- React DOM entry point (mounts <App />)
|   +-- App.tsx                <- Root component, keyboard handling, auto-save
|   +-- App.css                <- Global app-level styles
|   +-- index.css              <- CSS variables / Tailwind base
|   |
|   +-- components/
|   |   +-- canvas/
|   |   |   +-- Canvas.tsx             <- Core infinite canvas (Konva Stage)
|   |   |   +-- SelectionTransformer.tsx <- Multi-select resize/rotate handles
|   |   |   +-- ToolOptionsBar.tsx     <- Floating pen/eraser options bar
|   |   +-- layout/
|   |       +-- TopBar.tsx             <- Title bar, export, import, clear
|   |       +-- LeftToolbar.tsx        <- Tool picker sidebar
|   |       +-- BoardSettingsPanel.tsx <- Background pattern & color picker
|   |       +-- HomeDashboard.tsx      <- Board manager (create/switch/delete)
|   |
|   +-- store/
|   |   +-- boardStore.ts      <- Canvas objects state + undo/redo history
|   |   +-- uiStore.ts         <- Active tool, theme, pen settings, board identity
|   |
|   +-- services/
|   |   +-- db.ts              <- IndexedDB CRUD: initDB, saveBoard, loadBoard, listBoards, deleteBoard
|   |
|   +-- types/
|       +-- index.ts           <- TypeScript interfaces for all canvas object types
|
+-- build/                     <- Static build assets consumed by electron-builder
|   +-- icon.ico               <- Windows app icon (multi-resolution ICO)
|   +-- icon.png               <- Source icon (PNG, used for APPX logos)
|   +-- appx/                  <- APPX-specific tile images
|       +-- Square44x44Logo.png
|       +-- Square150x150Logo.png
|       +-- Wide310x150Logo.png
|       +-- StoreLogo.png
|
+-- Website/                   <- Static marketing/download website
|   +-- index.html
|   +-- style.css
|   +-- main.js
|   +-- assests/               <- Screenshot images (1.png-8.png)
|   +-- downloads/
|       +-- Whiteboard-Setup-1.0.exe
|
+-- dist/                      <- Vite-built renderer output (HTML/JS/CSS)
+-- dist-electron/             <- Compiled Electron main + preload JS
+-- release/                   <- electron-builder output (installers, APPX)
|
+-- index.html                 <- Vite HTML entry template
+-- vite.config.ts             <- Vite + Electron plugin configuration
+-- package.json               <- Scripts, dependencies, electron-builder config
+-- tsconfig.json              <- TypeScript project references root
+-- tsconfig.app.json          <- Renderer process TS config
+-- tsconfig.node.json         <- Node/Electron process TS config
+-- .oxlintrc.json             <- Linter rules
```

---

## 4. Architecture Overview

Digiboard follows the standard Electron two-process model:

```
+------------------------------------------------------------+
|                    ELECTRON PROCESS                        |
|                                                            |
|  +---------------------+      +--------------------------+ |
|  |   MAIN PROCESS      |      |   RENDERER PROCESS       | |
|  | (electron/main.ts)  | IPC  | (Chromium / React App)   | |
|  |                     | <--> |                          | |
|  | - BrowserWindow     |      | - React component tree   | |
|  | - App lifecycle     |      | - Konva canvas           | |
|  | - OS integration    |      | - Zustand stores         | |
|  | - Window chrome     |      | - IndexedDB persistence  | |
|  +---------------------+      +--------------------------+ |
|           ^                             ^                  |
|    preload.ts (contextBridge)    Vite-built dist/          |
+------------------------------------------------------------+
```

- The **main process** is a Node.js environment. It owns the OS window, menus, and system APIs.
- The **renderer process** runs inside a Chromium sandbox. It is a standard React SPA loaded inside the Electron BrowserWindow.
- The **preload script** bridges both: it has Node.js access but runs in the renderer context, exposing a safe ipcRenderer API via `contextBridge.exposeInMainWorld`.

---

## 5. The Electron Shell

### `electron/main.ts`

**1. Window creation** — A `BrowserWindow` is created with:
- Size: 1280x800, minimum 900x600
- `titleBarStyle: 'hidden'` — removes the default OS title bar
- `titleBarOverlay` — renders native window control buttons (close/minimize/maximize) overlaid on our custom TopBar (offset by `pr-[140px]` in CSS)
- `contextIsolation: true`, `nodeIntegration: false` — secure renderer sandbox

**2. Content loading:**
- Development: loads from the Vite dev server URL (`VITE_DEV_SERVER_URL`)
- Production: loads `dist/index.html` directly from disk

**3. Windows-specific Chromium flags** (critical for APPX sandbox):
```ts
app.commandLine.appendSwitch('disable-gpu-sandbox')
app.commandLine.appendSwitch('no-sandbox')
app.commandLine.appendSwitch('disable-web-security') // allow IndexedDB in local files
```
Required because the APPX package runs in a restricted Windows App Container. Without these, Chromium's IndexedDB fails with quota/disk cache errors.

### `electron/preload.ts`

Exposes a safe subset of `ipcRenderer` to the renderer via `contextBridge`:
```ts
contextBridge.exposeInMainWorld('ipcRenderer', {
  on:     (...) => ipcRenderer.on(...),
  off:    (...) => ipcRenderer.off(...),
  send:   (...) => ipcRenderer.send(...),
  invoke: (...) => ipcRenderer.invoke(...),
})
```

---

## 6. The React Frontend (Renderer Process)

### 6.1 Entry Points

- **`index.html`** — Vite HTML template; Vite injects scripts automatically
- **`src/main.tsx`** — Mounts `<App />` into `#root`
- **`src/App.tsx`** — Root component; orchestrates board loading, board switching, auto-save, and global keyboard shortcuts

### 6.2 State Management (Zustand)

#### `boardStore.ts` — Canvas Data

| State | Type | Description |
|---|---|---|
| `objects` | `Record<string, BaseObject>` | Hash map of all canvas objects by ID |
| `objectIds` | `string[]` | Ordered array of IDs (z-order) |
| `scale` | `number` | Current zoom level |
| `position` | `{ x, y }` | Current pan offset |
| `past` | `Snapshot[]` | Undo history stack |
| `future` | `Snapshot[]` | Redo history stack |

**Undo/Redo:** Every mutating action pushes the previous state onto `past` and clears `future`. `undo()` pops from `past` and pushes current onto `future`. `redo()` reverses this.

#### `uiStore.ts` — UI / Tool State

| State | Type | Description |
|---|---|---|
| `activeTool` | `Tool` | Currently selected drawing tool |
| `isSpacePressed` | `boolean` | Spacebar held = temporary pan |
| `theme` | `'light' or 'dark'` | App theme |
| `selectedIds` | `string[]` | IDs of selected objects |
| `penColor` | `string` | Active pen color (hex) |
| `penSize` | `number` | Pen stroke width |
| `eraserSize` | `number` | Eraser radius |
| `boardBackground` | `'dots' / 'ruled' / 'grid' / 'blank'` | Background pattern |
| `boardColor` | `'white' / 'cream' / 'sky' / 'mint' / 'lavender' / 'dark'` | Board tint |
| `activeBoardId` | `string` | UUID of current board |
| `activeBoardName` | `string` | Display name of current board |
| `isHomeOpen` | `boolean` | Board manager overlay visible |

Available tools: `select | pan | pen | eraser | text | sticky | rectangle | circle | triangle | line | arrow | image`

### 6.3 Type System (`src/types/index.ts`)

All objects extend `BaseObject`:
```ts
interface BaseObject {
  id: string        // UUID
  type: ObjectType
  x: number         // Canvas X
  y: number         // Canvas Y
  width: number
  height: number
  rotation: number  // Degrees
  opacity: number   // 0-1
  locked: boolean
  zIndex: number
}
```

| Type | Extra Fields |
|---|---|
| `RectangleObject` | fill, stroke, strokeWidth, cornerRadius? |
| `EllipseObject` | fill, stroke, strokeWidth |
| `PathObject` | points: number[], stroke, strokeWidth, tension? |
| `TextObject` | text, fontSize, fontFamily, fill, fontWeight, fontStyle, align |
| `StickyObject` | text, fontSize, fontFamily, color (bg), fill (text) |
| `ImageObject` | src (base64 data URL) |
| `ArrowObject` | points: number[], stroke, strokeWidth |

### 6.4 Persistence Layer (`src/services/db.ts`)

Uses the `idb` library (promise-based IndexedDB wrapper):

```
Database:     "whiteboard-app-db"   (version 1)
Object store: "boards"              (keyPath: "id")
Index:        "by-updated"          (on updatedAt, used for sorting)
```

Board record schema:
```ts
{
  id: string
  name: string
  createdAt: number    // ms timestamp
  updatedAt: number    // ms timestamp
  preview?: string     // Reserved for future thumbnail
  data: {
    objects: Record<string, BaseObject>
    objectIds: string[]
  }
}
```

Exported functions:
- `initDB()` — Opens/creates the DB (singleton, lazy)
- `saveBoard(id, name, objects, objectIds)` — Upserts a board
- `loadBoard(id)` — Gets one board by ID
- `listBoards()` — Returns all boards sorted by updatedAt
- `deleteBoard(id)` — Permanently removes a board

### 6.5 Components

#### `TopBar`
Custom title bar containing: Home button, inline-editable board title, BoardSettingsPanel, Clear canvas, Import JSON, Export PNG, Export JSON.

The Export PNG function queries `.konvajs-content canvas` directly from the DOM and calls `toDataURL('image/png')` — no server, no canvas re-render.

#### `LeftToolbar`
Vertical floating pill on the left edge. One button per tool. The **Image** tool opens a hidden `<input type="file">`, reads the selected file as a base64 Data URL, and adds it as an `ImageObject` centered in the viewport.

#### `BoardSettingsPanel`
Dropdown from TopBar. Controls:
- **Pattern**: Blank / Dots / Ruled / Grid
- **Color**: White / Cream / Sky / Mint / Lavender / Dark

Stored in `uiStore`; read by `Canvas.tsx` to generate the CSS background.

#### `HomeDashboard`
Full-screen overlay (z-50, backdrop blur). Responsive grid (`grid-cols-1` to `grid-cols-5`) of board cards. Features: New Board card, board cards with name + date, hover-revealed delete button, green dot on active board.

#### `ToolOptionsBar`
Floating pill at bottom-center. Shown only when Pen or Eraser is active.
- Pen: 10 preset colors + custom color picker + 5 dot size presets + range slider (1-50)
- Eraser: Preview circle + size range slider (5-80)

#### `SelectionTransformer`
Wraps Konva's built-in `Transformer`. Attaches to all selected nodes, showing resize and rotate handles.

---

## 7. The Canvas Engine (Konva + react-konva)

Konva is a 2D canvas library that wraps the HTML `<canvas>` element with a React-friendly component API.

### Coordinate System

All object positions are stored in unscaled canvas units. The `Stage` applies `scale` and `position` as CSS transforms on the canvas element. Mouse events are converted:

```ts
const getRelativePointerPosition = (stage) => ({
  x: (pointer.x - stage.x()) / stage.scaleX(),
  y: (pointer.y - stage.y()) / stage.scaleY(),
})
```

### Zoom

The `handleWheel` event zooms toward the mouse cursor:
1. Record the mouse position in canvas-space before scaling
2. Apply the new scale (clamped 0.1x – 10x)
3. Reposition the stage so the same canvas-space point stays under the cursor

### Pan

Triggered by:
- Holding **Space** (`isSpacePressed` → `isPanActive`)
- **Middle mouse button** drag
- **Pan tool** (H key)
- **Trackpad two-finger scroll** (detected via `Math.abs(wheelDeltaY) !== 120`)

### Drawing Pipeline

The app uses a "double buffer" pattern to avoid polluting the undo history with every mouse-move:

1. `handleMouseDown` → creates `drawingObject` in **local component state** (not Zustand)
2. `handleMouseMove` → updates `drawingObject` dimensions/points
3. `handleMouseUp` → calls `useBoardStore.getState().addObject(finalObj)`, clears `drawingObject`

Only the **final committed shape** enters the store and the undo stack.

### Freehand Paths (Pen Tool)

Accumulates `[x, y, x, y, ...]` pairs. A distance threshold (`dx² + dy² > 9`) prevents excessive density. On `mouseUp`, absolute canvas coords are converted to object-local coords (stored relative to the object's `x, y` origin).

### Eraser

Creates a `PathObject` with `tool: 'eraser'` and:
```tsx
globalCompositeOperation="destination-out"
```
This punches out pixels wherever drawn, rather than painting over them.

### Inline Text Editing

On double-click of a text or sticky node:
1. Konva text node → `opacity: 0` (hidden)
2. An absolutely-positioned `<textarea>` overlays at the exact same screen position, size, font, and rotation
3. Its value is live-bound to the object's `text` in `boardStore`
4. On blur: textarea unmounts, Konva text reappears

### Background Rendering

The background pattern is pure CSS on the container `<div>` (not a Konva node). Position is driven by `stage.x()`, `stage.y()`, and `stage.scaleX()` read at React render time, so it tracks pan and zoom automatically.

---

## 8. Build System (Vite + vite-plugin-electron)

### Development (`npm run dev`)

1. Vite starts its HMR dev server on a local port
2. `vite-plugin-electron` compiles `electron/main.ts` → `dist-electron/main.js` and spawns Electron
3. Electron loads the dev server URL; React HMR works for all components
4. Preload compiles and triggers renderer reload on change

### Production (`npm run build` then `npm run pack`)

**`npm run build`** = `tsc -b && vite build`:
- TypeScript type-checked across all tsconfig references
- Renderer bundled into `dist/` (hashed JS/CSS chunks)
- Main/preload compiled to `dist-electron/`

**`npm run pack`** = `electron-builder --win`:
- Reads `build` config from `package.json`
- Outputs to `release/`

### Output

| Directory | Contents |
|---|---|
| `dist/` | `index.html`, `assets/*.js`, `assets/*.css` |
| `dist-electron/` | `main.js`, `preload.mjs` |
| `release/` | `Whiteboard Setup 1.0.3.exe`, `Whiteboard 1.0.3.exe`, `Whiteboard 1.0.3.appx` |

---

## 9. Packaging to APPX (electron-builder)

The `package.json` `build` section drives everything:

```json
"build": {
  "appId": "com.digiboard.app",
  "productName": "Whiteboard",
  "copyright": "Copyright 2026 Digiboard",
  "directories": { "output": "release" },
  "win": {
    "target": ["nsis", "portable", "appx"],
    "icon": "build/icon.png"
  },
  "appx": {
    "applicationId": "AbhijithN.Digiboard",
    "backgroundColor": "#4f46e5",
    "displayName": "Digiboard",
    "identityName": "AbhijithN.Digiboard",
    "publisher": "CN=C442DDF1-9670-4E19-B9FD-354F70E192AD",
    "publisherDisplayName": "Abhijith_N"
  },
  "files": ["dist/**/*", "dist-electron/**/*", "package.json"]
}
```

### What electron-builder does

1. Collects `dist/`, `dist-electron/`, `package.json` (the `files` array)
2. Downloads the Electron binary for win32-x64
3. Builds three targets simultaneously:

| Target | Output file | Description |
|---|---|---|
| nsis | Whiteboard Setup 1.0.3.exe | Full Windows installer (install/uninstall) |
| portable | Whiteboard 1.0.3.exe | Single-file exe, no installation needed |
| appx | Whiteboard 1.0.3.appx | Microsoft Store package |

4. For **appx** specifically:
   - Generates `AppxManifest.xml` with identity and capability declarations
   - Copies tile images from `build/appx/`
   - Outputs `Whiteboard 1.0.3.appx` (~173 MB) to `release/`

### The publisher CN field

```
"publisher": "CN=C442DDF1-9670-4E19-B9FD-354F70E192AD"
```

This is the certificate subject matching your Microsoft Partner Center identity. The GUID is assigned by Microsoft when you register. It must match exactly or the Store rejects the submission.

---

## 10. APPX Package Internals

An `.appx` file is a ZIP archive containing:

```
Whiteboard 1.0.3.appx/
|
+-- AppxManifest.xml       <- Package identity, capabilities, visual assets
+-- AppxBlockMap.xml       <- Block-level hashes for integrity verification
+-- [Content_Types].xml    <- MIME type declarations
+-- resources.pri          <- Packaged resource index
|
+-- app/                   <- The Electron application
|   +-- Whiteboard.exe     <- Renamed electron.exe
|   +-- resources/
|   |   +-- app.asar       <- All app source files (Asar archive)
|   |       +-- dist/
|   |       +-- dist-electron/
|   |       +-- package.json
|   +-- [Electron DLLs, vk_swiftshader_icd.json, Chromium resources...]
|
+-- Assets/                <- Tile images
    +-- Square44x44Logo.png
    +-- Square150x150Logo.png
    +-- Wide310x150Logo.png
    +-- StoreLogo.png
```

### AppxManifest.xml (key excerpts)

```xml
<Identity
  Name="AbhijithN.Digiboard"
  Publisher="CN=C442DDF1-9670-4E19-B9FD-354F70E192AD"
  Version="1.0.3.0" />

<Properties>
  <DisplayName>Digiboard</DisplayName>
  <PublisherDisplayName>Abhijith_N</PublisherDisplayName>
  <Logo>Assets\StoreLogo.png</Logo>
</Properties>

<Capabilities>
  <rescap:Capability Name="runFullTrust" />
</Capabilities>
```

The `runFullTrust` restricted capability is **mandatory** for Electron apps in the Store. Electron runs as a full Win32 process, not a sandboxed UWP process. Microsoft manually reviews this during certification.

### The `release/win-unpacked/` folder

This is the raw unpacked Electron app before ZIP compression into an installer. It contains `vk_swiftshader_icd.json` (Vulkan SwiftShader ICD config used by Chromium's GPU process) and all Chromium/Electron DLLs. This folder's contents become the `app/` directory inside the APPX.

---

## 11. Publishing to the Microsoft Store (Partner Center)

### Step 1: Register

Go to [partner.microsoft.com](https://partner.microsoft.com), create a developer account:
- One-time fee: ~$19 (individual), ~$99 (company)
- Note your **Publisher ID** (the GUID that goes in `publisher`)

### Step 2: Reserve your app name

Partner Center → Apps and Games → New product → App. This gives you:
- A **Store ID**
- Your **Package identity name** (e.g. `AbhijithN.Digiboard`)

### Step 3: Align `package.json` with Partner Center

```json
"appx": {
  "applicationId":       "AbhijithN.Digiboard",
  "identityName":        "AbhijithN.Digiboard",
  "publisher":           "CN=<your-publisher-guid>",
  "publisherDisplayName":"Abhijith_N",
  "displayName":         "Digiboard",
  "backgroundColor":     "#4f46e5"
}
```

### Step 4: Build

```bash
npm run build    # TypeScript check + Vite bundle
npm run pack     # electron-builder --win
```

Output: `release/Whiteboard 1.0.3.appx` (~173 MB)

### Step 5: Create a submission

Partner Center → your app → Start a submission:
1. **Pricing and availability** — markets, price, release date
2. **Properties** — category (Productivity), subcategory, age ratings, privacy policy URL
3. **Store listing** — app description, screenshots, short description, keywords
4. **Packages** — upload `Whiteboard 1.0.3.appx`

### Step 6: Age ratings (IARC questionnaire)

For a productivity whiteboard with no user-to-user content sharing, typical result: **Everyone (E)** or **3+**.

### Step 7: Screenshots

Minimum: 1 desktop screenshot (1920x1080 PNG). The `Website/assests/` folder contains 8 prepared screenshots (1.png–8.png).

### Step 8: Submit for certification

Microsoft runs:
- **WACK (Windows App Certification Kit)** — automated manifest, capability, crash tests
- **Policy review** — content, metadata, functionality compliance
- **Malware scan** — all binaries scanned

Typical timeline: **1–5 business days**.

### Step 9: Live

Once approved, the app appears in the Microsoft Store. For updates: bump `version` in `package.json`, rebuild the APPX, and upload to a new submission on the same app listing.

---

## 12. Data Flow Diagram

```
User draws / types / clicks
         |
         v
Canvas.tsx handles mouse events
         |
         | --> useBoardStore.getState().addObject(obj)
         |     useBoardStore.getState().updateObject(id, updates)
         |     useBoardStore.getState().deleteObjects(ids)
         v
boardStore (Zustand)
  objects: { [id]: BaseObject }
  objectIds: string[]
  past / future  (undo/redo stacks)
         |
         | Zustand notifies all subscribed components
         v
Canvas.tsx re-renders boardObjects via react-konva
         |
         | useEffect in App.tsx (debounced 1s) fires on objects/objectIds change
         v
services/db.ts  -->  saveBoard(id, name, objects, objectIds)
         |
         v
IndexedDB ("whiteboard-app-db")
  persisted to disk by Chromium's IDB engine
         |
         | On next app launch:
         v
App.tsx --> listBoards() --> loadBoard(id)
         |
         | useBoardStore.setState({ objects, objectIds, past: [], future: [] })
         v
Canvas.tsx re-renders with restored board data
```

---

## 13. Keyboard Shortcuts Reference

| Shortcut | Action |
|---|---|
| V | Select tool |
| H | Pan tool |
| P | Pen tool |
| E | Eraser tool |
| T | Text tool |
| N | Sticky note tool |
| R | Rectangle tool |
| Space (hold) | Temporary pan mode |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Delete / Backspace | Delete selected objects |
| Shift+Click | Add/remove from multi-selection |
| Double-click | Edit text / sticky note inline |
| Mouse wheel | Zoom in/out |
| Trackpad scroll | Pan (two-finger) |
| Middle mouse drag | Pan |

---

## 14. Known Platform Quirks & Fixes Applied

### IndexedDB failing in APPX (Windows App Container)

**Problem:** When running from the APPX sandbox, Chromium's IndexedDB initialization fails with quota and disk cache errors. The App Container restricts filesystem access in a way that breaks Chromium's default IDB path resolution.

**Fix in `electron/main.ts`:**
```ts
app.commandLine.appendSwitch('disable-gpu-sandbox')
app.commandLine.appendSwitch('no-sandbox')
app.commandLine.appendSwitch('disable-web-security')
```
Plus `sandbox: false` in `BrowserWindow.webPreferences`. Together these let Chromium resolve its storage paths in the APPX container correctly.

**Graceful degradation:** If IDB still fails, `App.tsx` catches the error and sets `dbAvailable = false`. The canvas works fully — only auto-save is silently disabled. Users can still draw and export manually.

### Custom title bar with native window controls

**Problem:** `titleBarStyle: 'hidden'` removes all OS chrome, but native close/minimize/maximize buttons improve accessibility and UX.

**Fix:** `titleBarOverlay` is configured with a white background and dark symbols. `TopBar` adds `pr-[140px]` to prevent content from being obscured by the overlay buttons on the right. Interactive elements inside TopBar use `style={{ WebkitAppRegion: 'no-drag' }}` to prevent accidental window dragging.

### LF/CRLF line endings on Windows

Git warns about LF to CRLF conversion when staging files. This is expected on Windows. To configure:
```bash
git config core.autocrlf true
```
Or add `.gitattributes` to enforce consistent line endings across contributors.

---

*This document reflects the state of the codebase at commit `03ca922` (2026-09-09).*
