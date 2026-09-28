import { useEffect, useState } from 'react'
import { Plus, X, Clock, FileEdit, Trash2 } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { useBoardStore } from '../../store/boardStore'
import { listBoards, deleteBoard, saveBoard } from '../../services/db'
import { syncEngine } from '../../lib/syncEngine'
import { BoardSyncBadge } from './BoardSyncBadge'
import { BoardThumbnail } from './BoardThumbnail'
import { BoardNameDialog } from './BoardNameDialog'
import { suggestBoardName } from '../../lib/boardNames'

interface BoardMeta {
  id: string
  name: string
  updatedAt: number
  objects: Record<string, any>
  objectIds: string[]
}

export const HomeDashboard = () => {
  const isHomeOpen = useUIStore(s => s.isHomeOpen)
  const setHomeOpen = useUIStore(s => s.setHomeOpen)
  const activeBoardId = useUIStore(s => s.activeBoardId)
  const setActiveBoard = useUIStore(s => s.setActiveBoard)

  const [boards, setBoards] = useState<BoardMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [namingNew, setNamingNew] = useState(false)

  useEffect(() => {
    if (isHomeOpen) {
      setLoading(true)
      listBoards()
        .then(data => {
          // Sort by recently updated first
          const sorted = data.sort((a, b) => b.updatedAt - a.updatedAt)
          setBoards(sorted.map(b => ({
            id: b.id,
            name: b.name,
            updatedAt: b.updatedAt,
            // The full board is already in hand, so the preview costs no extra
            // read. A board's top-level objects are its active page (other pages
            // live in pageSnapshots), so this is the page the user last saw.
            objects: b.data?.objects ?? {},
            objectIds: b.data?.objectIds ?? [],
          })))
        })
        .finally(() => setLoading(false))
    }
  }, [isHomeOpen])

  if (!isHomeOpen) return null

  const handleCreateNew = () => {
    // Naming is a deliberate step: board names are the only handle a user has
    // for finding work again, and they must be unique to be useful.
    setNamingNew(true)
  }

  const confirmCreateNew = async (name: string) => {
    setNamingNew(false)
    const newId = crypto.randomUUID()
    useBoardStore.setState({ objects: {}, objectIds: [], past: [], future: [] })
    // Persist the empty board before switching to it. Without this the id has no
    // file yet, App's loader treats it as stale, and the user is bounced back to
    // the first board — the new board then never gets written or synced.
    await saveBoard(newId, name, {}, [])
    setActiveBoard(newId, name)
    setHomeOpen(false)
  }

  const handleSelectBoard = (id: string, name: string) => {
    // We don't load the board data here, App.tsx will detect the activeBoardId change and load it
    setActiveBoard(id, name)
    setHomeOpen(false)
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (window.confirm('Delete this board permanently?')) {
      await deleteBoard(id)
      // Tombstone only after the local delete succeeded, so a failed local
      // write can never leave the cloud copy deleted while the board still
      // exists here. Queued rather than sent, so deleting offline is safe.
      syncEngine.markDeleted(id)
      const remaining = boards.filter(x => x.id !== id)
      setBoards(remaining)
      if (activeBoardId === id) {
        // If we deleted the active board, reset to a new one. Persisted first so
        // App's loader finds it instead of treating the id as stale. The name has
        // to dodge whatever the deleted board was called, or it would duplicate.
        const newId = crypto.randomUUID()
        const newName = suggestBoardName(remaining)
        useBoardStore.setState({ objects: {}, objectIds: [], past: [], future: [] })
        await saveBoard(newId, newName, {}, [])
        setActiveBoard(newId, newName)
      }
    }
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex items-center justify-between p-6 shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">Your Whiteboards</h1>
        <button 
          onClick={() => setHomeOpen(false)}
          className="p-2 hover:bg-accent rounded-full transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      {namingNew && (
        <BoardNameDialog
          initialValue={suggestBoardName(boards)}
          title="Name your board"
          submitLabel="Create board"
          onCancel={() => setNamingNew(false)}
          onSubmit={confirmCreateNew}
        />
      )}

      <div className="flex-1 overflow-y-auto p-6 pt-0">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            
            {/* Create New Button */}
            <button
              onClick={handleCreateNew}
              className="flex flex-col items-center justify-center gap-4 aspect-[4/3] rounded-2xl border-2 border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 transition-all group"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Plus size={24} className="text-primary" />
              </div>
              <span className="font-semibold text-primary">New Board</span>
            </button>

            {/* Existing Boards */}
            {boards.map(board => (
              <div
                key={board.id}
                onClick={() => handleSelectBoard(board.id, board.name)}
                className="group relative flex flex-col aspect-[4/3] rounded-2xl border border-border bg-card overflow-hidden cursor-pointer hover:shadow-xl hover:border-primary/50 transition-all"
              >
                <div className="flex-1 bg-muted/30 relative overflow-hidden">
                  <BoardThumbnail objects={board.objects} objectIds={board.objectIds} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    {/* Placeholder stays behind the preview and only shows through
                        when a board is genuinely empty. */}
                    <FileEdit
                      size={32}
                      className="text-muted-foreground/30 group-hover:text-primary/40 transition-colors"
                    />
                  </div>
                </div>
                
                <div className="p-4 border-t border-border bg-card">
                  <h3 className="font-semibold truncate pr-8">{board.name}</h3>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                    <Clock size={12} />
                    <span>{new Date(board.updatedAt).toLocaleDateString()}</span>
                    <BoardSyncBadge boardId={board.id} />
                  </div>
                </div>

                <button
                  onClick={(e) => handleDelete(e, board.id)}
                  className="absolute right-3 bottom-3 p-1.5 text-muted-foreground hover:text-danger hover:bg-danger-muted rounded-md opacity-0 group-hover:opacity-100 transition-all"
                  title="Delete Board"
                >
                  <Trash2 size={16} />
                </button>
                
                {activeBoardId === board.id && (
                  <div className="absolute top-3 right-3 w-3 h-3 rounded-full bg-success shadow-[0_0_8px_var(--success)]" title="Currently Active" />
                )}
              </div>
            ))}

          </div>
        )}
      </div>
    </div>
  )
}
