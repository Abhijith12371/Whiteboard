# Whiteboard

A desktop infinite canvas application for drawing, diagramming, and brainstorming. 

## Features

- Infinite canvas with panning and zooming
- Offline-first auto-save using IndexedDB
- Multiple board management
- Customizable board themes (dots, grid, ruled, solid colors)
- Drawing tools: Pen and Eraser with customizable thickness and colors
- Shape tools: Rectangle, Circle, Triangle, Line, and Arrow
- Text fields and Sticky notes
- Image import support
- Export to PNG or JSON
- Import from JSON

## Installation

You can download the compiled Windows executable from the Releases page.

1. Go to the [Releases](../../releases) tab on GitHub.
2. Download `Whiteboard Setup X.X.X.exe` for the installer or `Whiteboard X.X.X.exe` for the portable version.
3. Run the downloaded file.

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Space + Drag` | Pan canvas |
| `Ctrl + Scroll` | Zoom in/out |
| `V` | Select |
| `H` | Pan |
| `P` | Pen |
| `E` | Eraser |
| `T` | Text |
| `N` | Sticky Note |
| `R` | Rectangle |
| `Ctrl + Z` | Undo |
| `Ctrl + Shift + Z` | Redo |
| `Ctrl + C` | Copy |
| `Ctrl + V` | Paste |
| `Ctrl + D` | Duplicate |
| `Ctrl + G` | Group |
| `Ctrl + Shift + G` | Ungroup |
| `Delete` / `Backspace` | Delete selected |
| `Esc` | Cancel action |

## Development

Requirements: Node.js (v18+)

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build the executable
npm run build
npm run pack
```
