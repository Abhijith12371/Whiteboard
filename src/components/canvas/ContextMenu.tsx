import React, { useEffect, useRef } from 'react'
import { useUIStore } from '../../store/uiStore'
import { useBoardStore } from '../../store/boardStore'
import {
  Scissors, Copy, ClipboardPaste, CopyPlus, Trash2, Group as GroupIcon, Ungroup as UngroupIcon,
  Lock, Unlock, BringToFront, SendToBack, Type, StickyNote, Shapes, Smile, Image as ImageIcon,
} from 'lucide-react'
import { insertStickyAt, insertTextAt } from '../../lib/insertAssets'
import { pasteClipboard, fitToScreen } from '../../lib/workspaceActions'

interface ContextMenuProps {
  x: number
  y: number
  onClose: () => void
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null)
  
  const selectedIds = useUIStore(state => state.selectedIds)
  const setSelectedIds = useUIStore(state => state.setSelectedIds)
  const clipboard = useUIStore(state => state.clipboard)
  const setClipboard = useUIStore(state => state.setClipboard)
  
  const objects = useBoardStore(state => state.objects)
  const addObject = useBoardStore(state => state.addObject)
  const deleteObjects = useBoardStore(state => state.deleteObjects)
  const duplicateObjects = useBoardStore(state => state.duplicateObjects)
  const groupObjects = useBoardStore(state => state.groupObjects)
  const ungroupObjects = useBoardStore(state => state.ungroupObjects)
  const reorderObject = useBoardStore(state => state.reorderObject)
  const toggleLock = useBoardStore(state => state.toggleLock)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const handleAction = (action: () => void) => {
    action()
    onClose()
  }

  const selectedObjects = selectedIds.map(id => objects[id]).filter(Boolean)
  const hasSelection = selectedObjects.length > 0
  const isSingleGroup = selectedObjects.length === 1 && selectedObjects[0].type === 'group'
  const canGroup = selectedObjects.length > 1
  const allLocked = selectedObjects.length > 0 && selectedObjects.every(o => o.locked)
  const hasClipboard = clipboard.length > 0

  return (
    <div 
      ref={menuRef}
      className="absolute bg-card border border-border shadow-lg rounded-xl py-2 w-48 z-50 select-none text-sm"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {hasSelection ? (
        <>
          <MenuItem 
            icon={<Scissors size={16} />} 
            label="Cut" 
            shortcut="Ctrl+X"
            onClick={() => handleAction(() => {
              setClipboard(selectedObjects)
              deleteObjects(selectedIds)
              setSelectedIds([])
            })} 
          />
          <MenuItem 
            icon={<Copy size={16} />} 
            label="Copy" 
            shortcut="Ctrl+C"
            onClick={() => handleAction(() => setClipboard(selectedObjects))} 
          />
          {hasClipboard && (
            <MenuItem 
              icon={<ClipboardPaste size={16} />} 
              label="Paste" 
              shortcut="Ctrl+V"
              onClick={() => handleAction(() => {
                const newIds: string[] = []
                clipboard.forEach(obj => {
                  const newId = crypto.randomUUID()
                  newIds.push(newId)
                  addObject({ ...obj, id: newId, x: obj.x + 20, y: obj.y + 20 } as any)
                })
                setSelectedIds(newIds)
              })} 
            />
          )}
          <MenuItem 
            icon={<CopyPlus size={16} />} 
            label="Duplicate" 
            shortcut="Ctrl+D"
            onClick={() => handleAction(() => duplicateObjects(selectedIds))} 
          />
          <div className="h-px bg-border my-1" />
          {canGroup && (
            <MenuItem 
              icon={<GroupIcon size={16} />} 
              label="Group" 
              shortcut="Ctrl+G"
              onClick={() => handleAction(() => {
                groupObjects(selectedIds)
                setSelectedIds([])
              })} 
            />
          )}
          {isSingleGroup && (
            <MenuItem 
              icon={<UngroupIcon size={16} />} 
              label="Ungroup" 
              shortcut="Ctrl+Shift+G"
              onClick={() => handleAction(() => {
                ungroupObjects(selectedIds[0])
                setSelectedIds([])
              })} 
            />
          )}
          <div className="h-px bg-border my-1" />
          <MenuItem 
            icon={<BringToFront size={16} />} 
            label="Bring to Front" 
            onClick={() => handleAction(() => selectedIds.forEach(id => reorderObject(id, 'front')))} 
          />
          <MenuItem 
            icon={<SendToBack size={16} />} 
            label="Send to Back" 
            onClick={() => handleAction(() => selectedIds.forEach(id => reorderObject(id, 'back')))} 
          />
          <div className="h-px bg-border my-1" />
          <MenuItem 
            icon={allLocked ? <Unlock size={16} /> : <Lock size={16} />} 
            label={allLocked ? 'Unlock' : 'Lock'} 
            onClick={() => handleAction(() => toggleLock(selectedIds))} 
          />
          <MenuItem 
            icon={<Trash2 size={16} />} 
            label="Delete" 
            shortcut="Del"
            className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => handleAction(() => {
              deleteObjects(selectedIds)
              setSelectedIds([])
            })} 
          />
        </>
      ) : (
        <>
          <MenuItem
            icon={<ClipboardPaste size={16} />}
            label="Paste"
            shortcut="Ctrl+V"
            disabled={!hasClipboard}
            onClick={() => handleAction(() => pasteClipboard())}
          />
          <div className="h-px bg-border my-1" />
          <MenuItem icon={<Type size={16} />} label="Add Text" onClick={() => handleAction(() => insertTextAt('Text'))} />
          <MenuItem icon={<StickyNote size={16} />} label="Add Sticky Note" onClick={() => handleAction(() => insertStickyAt())} />
          <MenuItem
            icon={<Shapes size={16} />}
            label="Add Shape"
            onClick={() => handleAction(() => useUIStore.getState().setLibraryPanel('shapes'))}
          />
          <MenuItem
            icon={<Smile size={16} />}
            label="Add Icon"
            onClick={() => handleAction(() => useUIStore.getState().setLibraryPanel('icons'))}
          />
          <MenuItem
            icon={<StickyNote size={16} />}
            label="Add Sticker"
            onClick={() => handleAction(() => useUIStore.getState().setLibraryPanel('stickers'))}
          />
          <MenuItem
            icon={<ImageIcon size={16} />}
            label="Add Image"
            onClick={() => handleAction(() => document.getElementById('image-upload')?.click())}
          />
          <div className="h-px bg-border my-1" />
          <MenuItem
            icon={<CopyPlus size={16} />}
            label="Create Page"
            onClick={() => handleAction(() => {
              useBoardStore.getState().addPage()
              useUIStore.getState().setRightPanel('pages')
            })}
          />
          <MenuItem
            icon={<ClipboardPaste size={16} />}
            label="Fit to Screen"
            onClick={() => handleAction(() => fitToScreen())}
          />
        </>
      )}
    </div>
  )
}

function MenuItem({ icon, label, shortcut, onClick, disabled, className }: any) {
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center px-4 py-1.5 hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed ${className || 'text-foreground'}`}
    >
      <span className="w-5 mr-2 flex justify-center">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {shortcut && <span className="text-muted-foreground ml-4 text-xs">{shortcut}</span>}
    </button>
  )
}
