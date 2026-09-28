import React, { useState } from 'react'
import { Eye, EyeOff, Lock, Unlock, Trash2, GripVertical, X } from 'lucide-react'
import { clsx } from 'clsx'
import { useUIStore } from '../../store/uiStore'
import { useBoardStore } from '../../store/boardStore'

export const LayersPanel: React.FC = () => {
  const isOpen = useUIStore((state) => state.isLayersPanelOpen)
  const setOpen = useUIStore((state) => state.setLayersPanelOpen)
  const selectedIds = useUIStore((state) => state.selectedIds)
  const setSelectedIds = useUIStore((state) => state.setSelectedIds)

  const objects = useBoardStore((state) => state.objects)
  const objectIds = useBoardStore((state) => state.objectIds)
  const updateObject = useBoardStore((state) => state.updateObject)
  const reorderObject = useBoardStore((state) => state.reorderObject)
  const deleteObjects = useBoardStore((state) => state.deleteObjects)
  const toggleLock = useBoardStore((state) => state.toggleLock)
  const toggleVisibility = useBoardStore((state) => state.toggleVisibility)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  if (!isOpen) return null

  // Display top to bottom -> highest zIndex (last in array) at the top
  const reversedIds = [...objectIds].reverse()

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id)
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    const draggedId = e.dataTransfer.getData('text/plain')
    if (draggedId && draggedId !== targetId) {
      // Very basic reordering for now - bring dragged to front/back of target
      const draggedIdx = objectIds.indexOf(draggedId)
      const targetIdx = objectIds.indexOf(targetId)
      
      if (draggedIdx > targetIdx) {
        reorderObject(draggedId, 'down')
      } else {
        reorderObject(draggedId, 'up')
      }
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDoubleClick = (id: string, currentName: string) => {
    setEditingId(id)
    setEditName(currentName)
  }

  const handleNameSave = (id: string) => {
    updateObject(id, { name: editName })
    setEditingId(null)
  }

  const getObjectName = (obj: any) => {
    if (obj.name) return obj.name
    if (obj.type === 'text' || obj.type === 'sticky' || obj.type === 'mindmap' || obj.type === 'card') return obj.text || obj.type
    if (obj.type === 'frame') return obj.label || 'Frame'
    return `${obj.type} ${obj.id.slice(0, 4)}`
  }

  return (
    <div className="absolute right-0 top-0 bottom-0 w-64 bg-card border-l border-border shadow-xl flex flex-col z-20">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Layers</h2>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
          <X size={20} />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        {reversedIds.map((id) => {
          const obj = objects[id]
          if (!obj) return null

          const isSelected = selectedIds.includes(id)
          const name = getObjectName(obj)

          return (
            <div
              key={id}
              draggable
              onDragStart={(e) => handleDragStart(e, id)}
              onDrop={(e) => handleDrop(e, id)}
              onDragOver={handleDragOver}
              onClick={() => setSelectedIds([id])}
              className={clsx(
                "flex items-center gap-2 p-2 mb-1 rounded-lg cursor-pointer transition-colors group",
                isSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-foreground"
              )}
            >
              <div className="cursor-grab active:cursor-grabbing text-muted-foreground opacity-50 group-hover:opacity-100">
                <GripVertical size={16} />
              </div>

              <div className="flex-1 min-w-0">
                {editingId === id ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => handleNameSave(id)}
                    onKeyDown={(e) => e.key === 'Enter' && handleNameSave(id)}
                    className="w-full bg-background border border-input rounded px-1 text-sm"
                    autoFocus
                  />
                ) : (
                  <span 
                    onDoubleClick={() => handleDoubleClick(id, name)}
                    className={clsx("text-sm truncate block select-none", obj.hidden && "opacity-50")}
                  >
                    {name}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); toggleVisibility([id]) }}
                  className="p-1 hover:bg-background rounded text-muted-foreground"
                >
                  {obj.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleLock([id]) }}
                  className="p-1 hover:bg-background rounded text-muted-foreground"
                >
                  {obj.locked ? <Lock size={14} /> : <Unlock size={14} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteObjects([id]) }}
                  className="p-1 hover:bg-destructive/10 hover:text-destructive rounded text-muted-foreground"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )
        })}
        {reversedIds.length === 0 && (
          <div className="text-center text-muted-foreground text-sm p-4">
            No objects
          </div>
        )}
      </div>
    </div>
  )
}
