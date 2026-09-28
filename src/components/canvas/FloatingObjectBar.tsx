import type { ReactNode } from 'react'
import { Copy, CopyPlus, Lock, Unlock, Trash2, Layers, MoreHorizontal, Palette } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { useBoardStore } from '../../store/boardStore'
import { duplicateSelection, deleteSelection } from '../../lib/workspaceActions'
import { lucideToDataUrl } from '../../lib/lucideSvg'

const COLORS = ['#09090b', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ffffff']

export function FloatingObjectBar() {
  const selectedIds = useUIStore((s) => s.selectedIds)
  const isPresenting = useUIStore((s) => s.isPresenting)
  const objects = useBoardStore((s) => s.objects)
  const toggleLock = useBoardStore((s) => s.toggleLock)
  const groupObjects = useBoardStore((s) => s.groupObjects)
  const reorderObject = useBoardStore((s) => s.reorderObject)
  const updateObject = useBoardStore((s) => s.updateObject)
  const setRightPanel = useUIStore((s) => s.setRightPanel)

  if (isPresenting || selectedIds.length === 0) return null
  const objs = selectedIds.map((id) => objects[id]).filter(Boolean)
  if (!objs.length) return null
  const allLocked = objs.every((o) => o.locked)
  const first = objs[0] as any

  const recolor = (color: string) => {
    objs.forEach((o: any) => {
      // Picking a swatch is an explicit choice, so it must beat an `auto` mark's
      // theme-relative ink — otherwise the pick is silently ignored.
      if (o.assetKind === 'icon' && o.iconName) {
        updateObject(o.id, { iconColor: color, src: lucideToDataUrl(o.iconName, color) })
      } else if (o.type === 'text' || o.type === 'path' || o.type === 'line' || o.type === 'arrow') {
        updateObject(o.id, { ...(o.type === 'text' ? { fill: color } : { stroke: color }), colorMode: 'custom' })
      } else if (o.fill !== undefined) {
        updateObject(o.id, { stroke: color, colorMode: 'custom' })
      }
    })
  }

  return (
    <div className="absolute left-1/2 top-16 z-30 -translate-x-1/2 flex items-center gap-0.5 rounded-xl border border-border bg-card px-1.5 py-1 shadow-lg">
      <IconBtn label="Duplicate" onClick={duplicateSelection}><CopyPlus size={15} /></IconBtn>
      <div className="flex items-center gap-0.5 px-1">
        {COLORS.map((c) => (
          <button
            key={c}
            aria-label={`Color ${c}`}
            title="Color"
            onClick={() => recolor(c)}
            className="h-4 w-4 rounded-full border border-border"
            style={{ background: c }}
          />
        ))}
      </div>
      <IconBtn label={allLocked ? 'Unlock' : 'Lock'} onClick={() => toggleLock(selectedIds)}>
        {allLocked ? <Unlock size={15} /> : <Lock size={15} />}
      </IconBtn>
      {selectedIds.length > 1 && (
        <IconBtn label="Group" onClick={() => {
          const gid = crypto.randomUUID()
          groupObjects(selectedIds, gid)
          useUIStore.getState().setSelectedIds([gid])
        }}>
          <Copy size={15} />
        </IconBtn>
      )}
      <IconBtn label="Bring forward" onClick={() => selectedIds.forEach((id) => reorderObject(id, 'up'))}>
        <Layers size={15} />
      </IconBtn>
      <IconBtn label="Delete" onClick={deleteSelection}><Trash2 size={15} /></IconBtn>
      <IconBtn label="More properties" onClick={() => setRightPanel('properties')}>
        <MoreHorizontal size={15} />
      </IconBtn>
      <span className="sr-only"><Palette size={12} /></span>
      {first.assetKind === 'icon' && <span className="px-2 text-[11px] text-muted-foreground">Icon</span>}
      {first.assetKind === 'sticker' && <span className="px-2 text-[11px] text-muted-foreground">Sticker</span>}
    </div>
  )
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground">
      {children}
    </button>
  )
}
