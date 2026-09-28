import { useEffect, useRef, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { listBoards } from '../../services/db'
import { validateBoardName, MAX_BOARD_NAME, type BoardNameEntry } from '../../lib/boardNames'

interface BoardNameDialogProps {
  /** Pre-filled name; empty for a new board. */
  initialValue?: string
  /** The board being renamed, so keeping its own name is not a clash. */
  ignoreId?: string
  title: string
  submitLabel: string
  onCancel: () => void
  onSubmit: (name: string) => void | Promise<void>
}

/**
 * Asks for a board name and refuses duplicates.
 *
 * Mount this only while the dialog should be visible. Mounting fresh per open is
 * what gives the field its initial value — holding an `open` flag and resetting
 * in an effect would leave stale text in the box.
 *
 * Existing names are read here rather than passed in, so create and rename
 * cannot drift apart and callers don't have to hold the board list to check
 * against.
 */
export function BoardNameDialog({
  initialValue = '',
  ignoreId,
  title,
  submitLabel,
  onCancel,
  onSubmit,
}: BoardNameDialogProps) {
  const [value, setValue] = useState(initialValue)
  const [boards, setBoards] = useState<BoardNameEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Select the existing text so typing replaces the name instead of appending.
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
    let cancelled = false
    listBoards()
      .then(list => {
        if (!cancelled) setBoards(list.map(b => ({ id: b.id, name: b.name })))
      })
      .catch(() => {
        if (!cancelled) setBoards([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const submit = async () => {
    const problem = validateBoardName(value, boards, ignoreId)
    if (problem) {
      setError(problem)
      return
    }
    await onSubmit(value.trim())
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-scrim/40 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-label={title}
        className="w-[min(420px,94vw)] rounded-2xl border border-border bg-card shadow-2xl p-6"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-semibold mb-1">{title}</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Board names must be unique so you can tell them apart.
        </p>

        <label htmlFor="board-name" className="block text-sm font-medium mb-1.5">
          Name
        </label>
        <input
          id="board-name"
          ref={inputRef}
          value={value}
          maxLength={MAX_BOARD_NAME}
          onChange={e => {
            setValue(e.target.value)
            // Clear the complaint as soon as the user starts fixing it.
            if (error) setError(null)
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void submit()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              onCancel()
            }
          }}
          placeholder="e.g. Q3 roadmap"
          aria-invalid={!!error}
          aria-describedby={error ? 'board-name-error' : undefined}
          className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />

        {error && (
          <p
            id="board-name-error"
            role="alert"
            className="mt-2 flex items-start gap-1.5 text-sm text-destructive"
          >
            <TriangleAlert size={15} className="shrink-0 mt-0.5" />
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void submit()}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
