# Modern Desktop Whiteboard

A blazing fast, infinite canvas whiteboard application built for the modern desktop. Inspired by Microsoft Whiteboard and FigJam, this app provides a minimal, professional workspace for diagramming, brainstorming, and sketching.

![Whiteboard Screenshot](./public/screenshot.png)

## 🚀 Features

- **Infinite Canvas:** Pan seamlessly in any direction and zoom from 10% to 500%.
- **Multiple Boards:** Create, manage, and rename multiple independent whiteboards from the Home Dashboard.
- **Smart Auto-Save:** Completely offline. Everything you draw is instantly saved to your local database using IndexedDB. 
- **Customizable Themes:** Switch between Light and Dark mode, or customize the board background (Dots, Ruled, Grid, or Blank) and color (White, Cream, Sky, Mint, Lavender, Dark).
- **Rich Tools:**
  - **Pen & Eraser:** Draw freely with customizable colors (10 presets + custom picker) and adjustable thickness.
  - **Shapes:** Quickly drag and drop Rectangles, Circles, Triangles, Lines, and Arrows.
  - **Text & Sticky Notes:** Add double-clickable text fields or colorful sticky notes.
  - **Images:** Drag and drop images directly onto the canvas.
- **Board Operations:** Select, move, resize, rotate, group, ungroup, duplicate, and delete elements with standard keyboard shortcuts.
- **Undo/Redo:** Full history tracking to quickly revert mistakes.
- **Export/Import:** Download your board as a high-quality PNG image, or export/import raw JSON data to share editable boards with colleagues.

## 📥 Download and Install

You can download the compiled Windows executable (`.exe`) directly from the Releases page of this repository.

1. Navigate to the **[Releases](../../releases)** page on this GitHub repository (look for the "Releases" section on the right sidebar of the main page).
2. Download `Whiteboard Setup X.X.X.exe` for a full installation, or `Whiteboard X.X.X.exe` for a portable version.
3. Double-click the downloaded file to run the Whiteboard!

> **Note:** If you are the repository owner and don't see any files in the Releases tab yet, please follow the [Release Instructions](#uploading-a-release) below to upload the `.exe`.

## 🛠️ Tech Stack

- **Framework:** [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Desktop Environment:** [Electron](https://www.electronjs.org/) + [Vite](https://vitejs.dev/)
- **Canvas Rendering:** [React Konva](https://konvajs.org/) (HTML5 Canvas)
- **State Management:** [Zustand](https://github.com/pmndrs/zustand)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons:** [Lucide React](https://lucide.dev/)
- **Database:** [idb](https://github.com/jakearchibald/idb) (IndexedDB Wrapper)

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Space + Drag` | Pan the canvas |
| `Ctrl + Scroll` | Zoom in/out |
| `V` | Select Tool |
| `H` | Pan (Hand) Tool |
| `P` | Pen Tool |
| `E` | Eraser Tool |
| `T` | Text Tool |
| `N` | Sticky Note Tool |
| `R` | Rectangle Tool |
| `Ctrl + Z` | Undo |
| `Ctrl + Shift + Z` | Redo |
| `Ctrl + C` | Copy |
| `Ctrl + V` | Paste |
| `Ctrl + D` | Duplicate |
| `Ctrl + G` | Group selected |
| `Ctrl + Shift + G` | Ungroup selected |
| `Delete` / `Backspace` | Delete selected |
| `Escape` | Cancel current action |

## 💻 Development

To run the application locally from source:

```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Build the production application (.exe)
npm run build
npm run pack
```

---

### Uploading a Release (For Repository Owners)

Due to GitHub's strict 100MB file limit for standard pushes, large compiled binaries (`.exe`) cannot be pushed directly via `git push`. To make the `.exe` available to users:

1. Build the app locally: `npm run pack`
2. Go to your GitHub repository in your web browser.
3. Click on **Releases** on the right side, then click **Draft a new release**.
4. Create a tag (e.g., `v1.0.0`) and a title.
5. Drag and drop the `Whiteboard Setup 0.0.0.exe` file (located in your local `release/` folder) into the "Attach binaries by dropping them here" box.
6. Click **Publish release**.
