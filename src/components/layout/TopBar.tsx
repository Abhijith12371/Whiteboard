import React from 'react'
import { useBoardStore } from '../../store/boardStore'
import { useUIStore } from '../../store/uiStore'

export const TopBar: React.FC = () => {
  const handleExportPNG = () => {
    // We can find the canvas stage and export it
    const stage = document.querySelector('canvas')?.closest('.konvajs-content')?.parentElement?.querySelector('canvas')
    if (stage) {
      const dataUrl = stage.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = 'whiteboard.png'
      link.href = dataUrl
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const handleExportJSON = () => {
    const objects = useBoardStore.getState().objects
    const objectIds = useBoardStore.getState().objectIds
    const data = JSON.stringify({ objects, objectIds }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = 'whiteboard.json'
    link.href = url
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleImportJSON = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = (e: any) => {
      const file = e.target.files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target?.result as string)
            if (data.objects && data.objectIds) {
              useBoardStore.setState({
                objects: data.objects,
                objectIds: data.objectIds,
                past: [],
                future: []
              })
              useUIStore.getState().setSelectedIds([])
            }
          } catch (err) {
            console.error('Failed to parse board file')
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }

  return (
    <div className="h-14 border-b border-border bg-background flex items-center justify-between px-4 z-10" style={{ WebkitAppRegion: 'drag' } as any}>
      <div className="font-semibold text-lg">Whiteboard</div>
      <div className="flex gap-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <button onClick={handleImportJSON} className="px-3 py-1.5 text-sm font-medium hover:bg-accent rounded-md transition-colors">Import JSON</button>
        <button onClick={handleExportPNG} className="px-3 py-1.5 text-sm font-medium hover:bg-accent rounded-md transition-colors">Export PNG</button>
        <button onClick={handleExportJSON} className="px-3 py-1.5 text-sm font-medium hover:bg-accent rounded-md transition-colors">Export JSON</button>
      </div>
    </div>
  )
}
