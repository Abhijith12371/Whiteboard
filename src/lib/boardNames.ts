/**
 * Board naming rules, shared by the create and rename flows.
 *
 * Both paths must agree, or the rule is meaningless: enforcing uniqueness only
 * on create would still let a board be renamed into a duplicate later.
 */

export const MAX_BOARD_NAME = 60

export interface BoardNameEntry {
  id: string
  name: string
}

/**
 * Returns an error message, or null when the name is acceptable.
 *
 * Comparison is case-insensitive and ignores surrounding whitespace, because
 * "Design" and "design" are the same name to a person scanning a list, and a
 * board grid can only show one of them legibly anyway.
 *
 * `ignoreId` is the board being renamed, so keeping its own name is allowed.
 */
export function validateBoardName(
  raw: string,
  boards: BoardNameEntry[],
  ignoreId?: string,
): string | null {
  const name = raw.trim()

  if (!name) return 'Give your board a name.'
  if (name.length > MAX_BOARD_NAME) {
    return `Keep the name under ${MAX_BOARD_NAME} characters.`
  }

  const taken = boards.some(
    b => b.id !== ignoreId && b.name.trim().toLowerCase() === name.toLowerCase(),
  )
  if (taken) return `A board called "${name}" already exists.`

  return null
}

/** First free "Untitled Board", "Untitled Board 2", … given what already exists. */
export function suggestBoardName(boards: BoardNameEntry[]): string {
  const taken = new Set(boards.map(b => b.name.trim().toLowerCase()))
  const base = 'Untitled Board'

  if (!taken.has(base.toLowerCase())) return base
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base} ${i}`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
  return base
}
