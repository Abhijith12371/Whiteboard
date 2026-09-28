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
        entry: 'electron/main.ts',
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload()
        },
        // Electron only accepts ESM preload scripts with a `.mjs` extension
        // (and `sandbox: false` in the BrowserWindow). Emitting `preload.js`
        // makes the context bridge fail to load at runtime.
        vite: {
          build: {
            rollupOptions: {
              output: { entryFileNames: '[name].mjs' },
            },
          },
        },
      },
    ]),
    renderer(),
  ],
})
