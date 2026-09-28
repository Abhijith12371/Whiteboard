import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
})

// Recolour the native window caption buttons to match the active theme.
contextBridge.exposeInMainWorld('__electron_setTitleBarOverlay', (options: { color: string; symbolColor: string }) => {
  return ipcRenderer.send('set-titlebar-overlay', options)
})

// Delivers `digiboard://` deep links (password reset, OAuth callbacks) to the
// renderer. Fired on cold start as well as while running, so the main process
// replays the pending URL after the window finishes loading.
contextBridge.exposeInMainWorld('__electron_deepLink', (listener: (url: string) => void) => {
  const handler = (_event: unknown, url: string) => listener(url)
  ipcRenderer.on('deep-link', handler)
  return () => ipcRenderer.removeListener('deep-link', handler)
})
