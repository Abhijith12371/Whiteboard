import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    electron([
      {
        // Electron's main process is CommonJS. package.json declares
        // "type": "module", so without an explicit CJS format the emitted
        // dist-electron/main.js is loaded as ESM and
        // `import { BrowserWindow } from 'electron'` fails with "does not
        // provide an export named 'BrowserWindow'" — the app never starts.
        // main.ts already relies on __dirname, which only exists in CJS.
        entry: 'electron/main.ts',
        vite: {
          build: {
            lib: { formats: ['cjs'] },
            rollupOptions: {
              output: { format: 'cjs', entryFileNames: '[name].cjs' },
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload()
        },
        // Same reasoning as main: emit CommonJS so contextBridge and ipcRenderer
        // are read from the CJS electron builtin rather than through ESM named
        // exports, which Electron's main process does not reliably provide.
        vite: {
          build: {
            lib: { formats: ['cjs'] },
            rollupOptions: {
              output: { format: 'cjs', entryFileNames: '[name].cjs' },
            },
          },
        },
      },
    ]),
    renderer(),
  ],
})
