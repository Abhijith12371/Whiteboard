export interface StickerAsset {
  id: string
  label: string
  bg: string
  fg: string
  keywords: string[]
  category: string
}

export const STICKER_CATALOG: StickerAsset[] = [
  { id: 'important', label: 'Important', bg: '#dc2626', fg: '#fff', keywords: ['important', 'priority', 'urgent'], category: 'Teaching' },
  { id: 'remember', label: 'Remember', bg: '#7c3aed', fg: '#fff', keywords: ['remember', 'memory', 'note'], category: 'Teaching' },
  { id: 'homework', label: 'Homework', bg: '#2563eb', fg: '#fff', keywords: ['homework', 'assignment'], category: 'Teaching' },
  { id: 'exam', label: 'Exam', bg: '#b45309', fg: '#fff', keywords: ['exam', 'test', 'quiz'], category: 'Teaching' },
  { id: 'key-point', label: 'Key Point', bg: '#0891b2', fg: '#fff', keywords: ['key', 'point', 'main'], category: 'Teaching' },
  { id: 'idea', label: 'Idea', bg: '#ca8a04', fg: '#fff', keywords: ['idea', 'insight', 'lightbulb'], category: 'Teaching' },
  { id: 'tip', label: 'Tip', bg: '#059669', fg: '#fff', keywords: ['tip', 'hint', 'help'], category: 'Teaching' },
  { id: 'warning', label: 'Warning', bg: '#ea580c', fg: '#fff', keywords: ['warning', 'caution', 'alert'], category: 'Teaching' },
  { id: 'question', label: 'Question', bg: '#4f46e5', fg: '#fff', keywords: ['question', 'ask'], category: 'Teaching' },
  { id: 'solved', label: 'Solved', bg: '#16a34a', fg: '#fff', keywords: ['solved', 'done', 'complete'], category: 'Teaching' },
  { id: 'todo', label: 'To Do', bg: '#334155', fg: '#fff', keywords: ['todo', 'task', 'later'], category: 'Study' },
  { id: 'correct', label: 'Correct', bg: '#15803d', fg: '#fff', keywords: ['correct', 'right', 'yes'], category: 'Study' },
  { id: 'incorrect', label: 'Incorrect', bg: '#b91c1c', fg: '#fff', keywords: ['incorrect', 'wrong', 'no'], category: 'Study' },
  { id: 'great', label: 'Great', bg: '#db2777', fg: '#fff', keywords: ['great', 'good', 'praise'], category: 'Study' },
  { id: 'review', label: 'Review', bg: '#0f766e', fg: '#fff', keywords: ['review', 'revise', 'revisit'], category: 'Study' },
  { id: 'deadline', label: 'Deadline', bg: '#9f1239', fg: '#fff', keywords: ['deadline', 'due', 'date'], category: 'Study' },
  { id: 'definition', label: 'Definition', bg: '#1d4ed8', fg: '#fff', keywords: ['definition', 'term', 'vocab'], category: 'Study' },
  { id: 'example', label: 'Example', bg: '#0369a1', fg: '#fff', keywords: ['example', 'sample'], category: 'Study' },
  { id: 'formula', label: 'Formula', bg: '#6d28d9', fg: '#fff', keywords: ['formula', 'equation', 'math'], category: 'Study' },
  { id: 'summary', label: 'Summary', bg: '#0e7490', fg: '#fff', keywords: ['summary', 'recap'], category: 'Study' },
]

export function searchStickers(query: string): StickerAsset[] {
  const q = query.trim().toLowerCase()
  if (!q) return STICKER_CATALOG
  return STICKER_CATALOG.filter((s) =>
    s.label.toLowerCase().includes(q) || s.keywords.some((k) => k.includes(q)) || s.category.toLowerCase().includes(q)
  )
}
