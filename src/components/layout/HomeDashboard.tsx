import { useEffect, useState } from 'react'
import { Plus, X, Clock, FileEdit, Trash2 } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { useBoardStore } from '../../store/boardStore'
import { listBoards, deleteBoard } from '../../services/db'

interface BoardMeta {
  id: string
  name: string
  updatedAt: number
}

export const HomeDashboard = () => {
  const isHomeOpen = useUIStore(s => s.isHomeOpen)
  const setHomeOpen = useUIStore(s => s.setHomeOpen)
  const activeBoardId = useUIStore(s => s.activeBoardId)
  const setActiveBoard = useUIStore(s => s.setActiveBoard)

  const [boards, setBoards] = useState<BoardMeta[]>([])
  const [loading, setLoading] = useState(true)

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
            updatedAt: b.updatedAt
          })))
        })
        .finally(() => setLoading(false))
    }
  }, [isHomeOpen])

  if (!isHomeOpen) return null

  const handleCreateNew = async () => {
    // Generate new ID and reset store
    const newId = crypto.randomUUID()
    useBoardStore.setState({ objects: {}, objectIds: [], past: [], future: [] })
    setActiveBoard(newId, 'Untitled Board')
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
      setBoards(b => b.filter(x => x.id !== id))
      if (activeBoardId === id) {
        // If we deleted the active board, reset to a new one
        const newId = crypto.randomUUID()
        useBoardStore.setState({ objects: {}, objectIds: [], past: [], future: [] })
        setActiveBoard(newId, 'Untitled Board')
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
                <div className="flex-1 bg-muted/30 p-4 flex items-center justify-center">
                  <FileEdit size={32} className="text-muted-foreground/30 group-hover:text-primary/40 transition-colors" />
                </div>
                
                <div className="p-4 border-t border-border bg-card">
                  <h3 className="font-semibold truncate pr-8">{board.name}</h3>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                    <Clock size={12} />
                    <span>{new Date(board.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <button
                  onClick={(e) => handleDelete(e, board.id)}
                  className="absolute right-3 bottom-3 p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                  title="Delete Board"
                >
                  <Trash2 size={16} />
                </button>
                
                {activeBoardId === board.id && (
                  <div className="absolute top-3 right-3 w-3 h-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" title="Currently Active" />
                )}
              </div>
            ))}

          </div>
        )}
      </div>
    </div>
  )
}

// Need to import Trash2 from lucide-react, I will just add it directly in the file since I used it above
// Let me update the file content to include Trash2
