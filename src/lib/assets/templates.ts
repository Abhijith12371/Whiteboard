import type { BaseObject } from '../../types'

export interface BoardTemplate {
  id: string
  name: string
  category: 'Education' | 'Business' | 'Design' | 'Development'
  description: string
  keywords: string[]
  build: () => { objects: Record<string, BaseObject>; objectIds: string[] }
}

function rect(id: string, x: number, y: number, w: number, h: number, extra: Record<string, any> = {}): BaseObject {
  return { id, type: 'rectangle', x, y, width: w, height: h, fill: extra.fill ?? '#ffffff', stroke: extra.stroke ?? '#cbd5e1', strokeWidth: extra.strokeWidth ?? 1.5, cornerRadius: extra.cornerRadius ?? 12, rotation: 0, opacity: 1, locked: false, zIndex: 0, ...extra } as any
}
function text(id: string, x: number, y: number, w: number, t: string, extra: Record<string, any> = {}): BaseObject {
  return { id, type: 'text', x, y, width: w, height: extra.height ?? 32, text: t, fontSize: extra.fontSize ?? 18, fontFamily: 'sans-serif', fill: extra.fill ?? '#0f172a', fontWeight: extra.fontWeight ?? 'bold', fontStyle: 'normal', align: extra.align ?? 'left', rotation: 0, opacity: 1, locked: false, zIndex: 1 } as any
}
/** A shape with its label baked in — one selectable/editable object. */
function card(id: string, x: number, y: number, w: number, h: number, t: string, extra: Record<string, any> = {}): BaseObject {
  return {
    id, type: 'card', x, y, width: w, height: h,
    shape: extra.shape ?? 'rect',
    fill: extra.fill ?? '#ffffff',
    stroke: extra.stroke ?? '#cbd5e1',
    strokeWidth: extra.strokeWidth ?? 1.5,
    cornerRadius: extra.cornerRadius ?? 0,
    dash: extra.dash,
    text: t,
    fontSize: extra.fontSize ?? 16,
    fontFamily: 'sans-serif',
    textColor: extra.textColor ?? '#0f172a',
    fontWeight: extra.fontWeight ?? 'bold',
    fontStyle: 'normal',
    align: extra.align ?? 'center',
    valign: extra.valign ?? 'middle',
    padding: extra.padding ?? 10,
    rotation: 0, opacity: 1, locked: false, zIndex: 0,
    ...extra,
  } as any
}
function sticky(id: string, x: number, y: number, t: string, color: string): BaseObject {
  return { id, type: 'sticky', x, y, width: 180, height: 160, text: t, fontSize: 16, fontFamily: 'sans-serif', fill: '#0f172a', color, rotation: 0, opacity: 1, locked: false, zIndex: 0 } as any
}

function pack(objs: BaseObject[]) {
  const objects: Record<string, BaseObject> = {}
  objs.forEach((o) => { objects[o.id] = o })
  return { objects, objectIds: objs.map((o) => o.id) }
}

export const TEMPLATES: BoardTemplate[] = [
  {
    id: 'classroom', name: 'Classroom', category: 'Education', description: 'Lesson board with objectives and notes',
    keywords: ['class', 'teach', 'lesson', 'education'],
    build: () => pack([
      text('t1', 40, 40, 480, 'Lesson title', { fontSize: 32 }),
      text('t2', 40, 88, 400, 'Learning objectives', { fontSize: 16, fontWeight: 'normal', fill: '#64748b' }),
      card('r1', 40, 140, 280, 220, 'Today we will…', { fill: '#eef2ff', stroke: '#6366f1', cornerRadius: 12, align: 'left', valign: 'top' }),
      sticky('s1', 360, 140, 'Key idea', '#fef08a'),
      sticky('s2', 560, 140, 'Example', '#bbf7d0'),
      card('r2', 40, 390, 700, 200, 'Notes', { fill: '#fff', stroke: '#cbd5e1', cornerRadius: 12, align: 'left', valign: 'top' }),
    ]),
  },
  {
    id: 'lesson-plan', name: 'Lesson Plan', category: 'Education', description: 'Warm-up, teach, practice, wrap-up',
    keywords: ['plan', 'teach', 'education'],
    build: () => pack([
      text('t1', 40, 30, 400, 'Lesson plan', { fontSize: 28 }),
      ...['Warm-up', 'Teach', 'Practice', 'Wrap-up'].map((label, i) =>
        card(`r${i}`, 40 + i * 200, 100, 180, 240, label, { fill: ['#fef9c3', '#e0e7ff', '#dcfce7', '#ffe4e6'][i], cornerRadius: 12, valign: 'top' })
      ),
    ]),
  },
  {
    id: 'cornell', name: 'Cornell Notes', category: 'Education', description: 'Cues, notes, and summary columns',
    keywords: ['notes', 'study', 'cornell'],
    build: () => pack([
      text('t1', 40, 24, 400, 'Cornell notes', { fontSize: 26 }),
      card('cues', 40, 80, 200, 420, 'Cues', { fill: '#fff7ed', stroke: '#fdba74', cornerRadius: 12, fontSize: 14, align: 'left', valign: 'top' }),
      card('notes', 250, 80, 520, 420, 'Notes', { fill: '#f8fafc', stroke: '#cbd5e1', cornerRadius: 12, fontSize: 14, align: 'left', valign: 'top' }),
      card('sum', 40, 510, 730, 120, 'Summary', { fill: '#ecfeff', stroke: '#67e8f9', cornerRadius: 12, fontSize: 14, align: 'left', valign: 'top' }),
    ]),
  },
  {
    id: 'study-notes', name: 'Study Notes', category: 'Education', description: 'Headings, highlights, and recap',
    keywords: ['study', 'notes', 'student'],
    build: () => pack([
      text('t1', 40, 30, 500, 'Study notes', { fontSize: 30 }),
      text('t2', 40, 80, 600, 'Concept', { fontSize: 18 }),
      rect('r1', 40, 120, 640, 160, { fill: '#ffffff' }),
      sticky('s1', 700, 120, 'Remember', '#fecaca'),
      text('t3', 40, 310, 300, 'Examples', { fontSize: 18 }),
      rect('r2', 40, 350, 640, 180, { fill: '#f0fdf4' }),
    ]),
  },
  {
    id: 'mind-map', name: 'Mind Map', category: 'Education', description: 'Central topic with branches',
    keywords: ['mind', 'map', 'brainstorm'],
    build: () => pack([
      card('root', 320, 200, 180, 64, 'Topic', { fill: '#4f46e5', stroke: '#4338ca', cornerRadius: 32, textColor: '#fff', fontSize: 18 }),
      card('c1', 80, 80, 140, 48, 'Branch A', { fill: '#e0e7ff', stroke: '#6366f1', cornerRadius: 12, fontSize: 14 }),
      card('c2', 80, 320, 140, 48, 'Branch B', { fill: '#dcfce7', stroke: '#22c55e', cornerRadius: 12, fontSize: 14 }),
      card('c3', 600, 80, 140, 48, 'Branch C', { fill: '#fef9c3', stroke: '#eab308', cornerRadius: 12, fontSize: 14 }),
      card('c4', 600, 320, 140, 48, 'Branch D', { fill: '#ffe4e6', stroke: '#fb7185', cornerRadius: 12, fontSize: 14 }),
    ]),
  },
  {
    id: 'flashcards', name: 'Flashcards', category: 'Education', description: 'Question and answer cards',
    keywords: ['cards', 'quiz', 'memory'],
    build: () => pack([0, 1, 2].flatMap((i) => [
      card(`q${i}`, 40 + i * 240, 80, 220, 140, `Question ${i + 1}`, { fill: '#eff6ff', stroke: '#60a5fa', cornerRadius: 12 }),
      card(`a${i}`, 40 + i * 240, 240, 220, 140, 'Answer', { fill: '#f0fdf4', stroke: '#4ade80', cornerRadius: 12 }),
    ])),
  },
  {
    id: 'problem-solving', name: 'Problem Solving', category: 'Education', description: 'Given, find, plan, solve, check',
    keywords: ['math', 'problem', 'solve'],
    build: () => pack([
      text('t', 40, 30, 400, 'Problem solving', { fontSize: 26 }),
      ...['Given', 'Find', 'Plan', 'Solve', 'Check'].map((label, i) =>
        card(`r${i}`, 40, 90 + i * 90, 700, 80, label, { fill: i % 2 ? '#f8fafc' : '#eef2ff', cornerRadius: 12, align: 'left', padding: 20 })
      ),
    ]),
  },
  {
    id: 'meeting', name: 'Meeting', category: 'Business', description: 'Agenda, notes, and actions',
    keywords: ['meeting', 'agenda', 'work'],
    build: () => pack([
      text('t', 40, 30, 400, 'Meeting notes', { fontSize: 26 }),
      card('a', 40, 90, 280, 360, 'Agenda', { fill: '#f8fafc', cornerRadius: 12, align: 'left', valign: 'top' }),
      card('n', 340, 90, 420, 220, 'Discussion', { fill: '#fff', cornerRadius: 12, align: 'left', valign: 'top' }),
      card('x', 340, 330, 420, 120, 'Action items', { fill: '#fef3c7', cornerRadius: 12, align: 'left', valign: 'top' }),
    ]),
  },
  {
    id: 'brainstorm', name: 'Brainstorm', category: 'Business', description: 'Sticky-note idea wall',
    keywords: ['ideas', 'brainstorm'],
    build: () => pack([
      text('t', 40, 24, 400, 'Brainstorm', { fontSize: 26 }),
      sticky('s1', 40, 90, 'Idea 1', '#fef08a'),
      sticky('s2', 240, 90, 'Idea 2', '#bbf7d0'),
      sticky('s3', 440, 90, 'Idea 3', '#bfdbfe'),
      sticky('s4', 40, 280, 'Idea 4', '#fecaca'),
      sticky('s5', 240, 280, 'Idea 5', '#e9d5ff'),
      sticky('s6', 440, 280, 'Idea 6', '#fed7aa'),
    ]),
  },
  {
    id: 'kanban', name: 'Kanban', category: 'Business', description: 'To do, doing, done columns',
    keywords: ['kanban', 'tasks', 'project'],
    build: () => pack([
      ...['To do', 'Doing', 'Done'].map((label, i) =>
        card(`c${i}`, 40 + i * 250, 60, 230, 460, label, { fill: '#f8fafc', cornerRadius: 12, align: 'left', valign: 'top' })
      ),
    ]),
  },
  {
    id: 'project', name: 'Project Planning', category: 'Business', description: 'Goals, milestones, risks',
    keywords: ['project', 'plan', 'roadmap'],
    build: () => pack([
      text('t', 40, 24, 400, 'Project plan', { fontSize: 26 }),
      card('g', 40, 80, 240, 280, 'Goals', { fill: '#eef2ff', cornerRadius: 12, align: 'left', valign: 'top' }),
      card('m', 300, 80, 240, 280, 'Milestones', { fill: '#ecfeff', cornerRadius: 12, align: 'left', valign: 'top' }),
      card('r', 560, 80, 240, 280, 'Risks', { fill: '#fff1f2', cornerRadius: 12, align: 'left', valign: 'top' }),
    ]),
  },
  {
    id: 'swot', name: 'SWOT', category: 'Business', description: 'Strengths, weaknesses, opportunities, threats',
    keywords: ['swot', 'strategy'],
    build: () => pack([
      text('t', 40, 20, 200, 'SWOT', { fontSize: 26 }),
      card('s', 40, 70, 300, 200, 'Strengths', { fill: '#dcfce7', cornerRadius: 12, align: 'left', valign: 'top' }),
      card('w', 360, 70, 300, 200, 'Weaknesses', { fill: '#fee2e2', cornerRadius: 12, align: 'left', valign: 'top' }),
      card('o', 40, 290, 300, 200, 'Opportunities', { fill: '#dbeafe', cornerRadius: 12, align: 'left', valign: 'top' }),
      card('h', 360, 290, 300, 200, 'Threats', { fill: '#fef9c3', cornerRadius: 12, align: 'left', valign: 'top' }),
    ]),
  },
  {
    id: 'roadmap', name: 'Roadmap', category: 'Business', description: 'Now, next, later',
    keywords: ['roadmap', 'timeline'],
    build: () => pack([
      text('t', 40, 24, 300, 'Roadmap', { fontSize: 26 }),
      ...['Now', 'Next', 'Later'].map((label, i) =>
        card(`r${i}`, 40 + i * 250, 90, 230, 280, label, { fill: ['#dbeafe', '#e0e7ff', '#f1f5f9'][i], cornerRadius: 12, fontSize: 18, align: 'left', valign: 'top' })
      ),
    ]),
  },
  {
    id: 'wireframe', name: 'Wireframe', category: 'Design', description: 'Simple app layout blocks',
    keywords: ['ui', 'wireframe', 'design'],
    build: () => pack([
      card('nav', 40, 40, 720, 56, 'Header', { fill: '#e2e8f0', cornerRadius: 8, align: 'left' }),
      rect('side', 40, 112, 180, 400, { fill: '#f1f5f9' }),
      card('main', 236, 112, 524, 400, 'Content', { fill: '#ffffff', cornerRadius: 12, align: 'left', valign: 'top' }),
    ]),
  },
  {
    id: 'user-flow', name: 'User Flow', category: 'Design', description: 'Start, screens, decision, end',
    keywords: ['flow', 'ux', 'user'],
    build: () => pack([
      card('a', 40, 160, 140, 56, 'Start', { fill: '#dcfce7', cornerRadius: 28, fontSize: 14 }),
      card('b', 240, 160, 160, 56, 'Screen', { fill: '#dbeafe', cornerRadius: 12, fontSize: 14 }),
      card('c', 460, 140, 140, 96, 'Decision', { fill: '#fef9c3', cornerRadius: 12, fontSize: 14 }),
      card('d', 660, 160, 140, 56, 'End', { fill: '#fecaca', cornerRadius: 28, fontSize: 14 }),
    ]),
  },
  {
    id: 'sitemap', name: 'Sitemap', category: 'Design', description: 'Home and child pages',
    keywords: ['sitemap', 'ia'],
    build: () => pack([
      card('h', 300, 40, 160, 48, 'Home', { fill: '#4f46e5', stroke: '#4f46e5', textColor: '#fff', fontSize: 14 }),
      card('a', 40, 160, 140, 48, 'Page A', { fill: '#e0e7ff', stroke: '#e0e7ff', fontSize: 14 }),
      card('b', 220, 160, 140, 48, 'Page B', { fill: '#e0e7ff', stroke: '#e0e7ff', fontSize: 14 }),
      card('c', 400, 160, 140, 48, 'Page C', { fill: '#e0e7ff', stroke: '#e0e7ff', fontSize: 14 }),
      card('d', 580, 160, 140, 48, 'Page D', { fill: '#e0e7ff', stroke: '#e0e7ff', fontSize: 14 }),
    ]),
  },
  {
    id: 'journey', name: 'Customer Journey', category: 'Design', description: 'Awareness to advocacy',
    keywords: ['journey', 'customer', 'ux'],
    build: () => pack([
      text('t', 40, 24, 400, 'Customer journey', { fontSize: 24 }),
      ...['Awareness', 'Consider', 'Purchase', 'Retain', 'Advocate'].map((label, i) =>
        card(`r${i}`, 40 + i * 150, 90, 140, 200, label, { fill: '#f8fafc', cornerRadius: 12, fontSize: 13, align: 'left', valign: 'top' })
      ),
    ]),
  },
  {
    id: 'architecture', name: 'System Architecture', category: 'Development', description: 'Client, API, services, data',
    keywords: ['architecture', 'system', 'diagram'],
    build: () => pack([
      card('c', 40, 80, 160, 80, 'Client', { fill: '#e0e7ff', cornerRadius: 12 }),
      card('a', 260, 80, 160, 80, 'API', { fill: '#dbeafe', cornerRadius: 12 }),
      card('s', 480, 40, 160, 80, 'Service', { fill: '#dcfce7', cornerRadius: 12 }),
      card('d', 480, 140, 160, 80, 'Database', { fill: '#fef9c3', cornerRadius: 12 }),
    ]),
  },
  {
    id: 'system-design', name: 'System Design', category: 'Development', description: 'Load balancer, app, cache, db',
    keywords: ['design', 'backend'],
    build: () => pack([
      card('u', 300, 20, 140, 48, 'Users', { fill: '#e2e8f0', cornerRadius: 12, fontSize: 14 }),
      card('lb', 280, 100, 180, 56, 'Load balancer', { fill: '#dbeafe', cornerRadius: 12, fontSize: 14 }),
      card('app', 80, 200, 160, 64, 'App servers', { fill: '#e0e7ff', cornerRadius: 12, fontSize: 14 }),
      card('cache', 300, 200, 160, 64, 'Cache', { fill: '#fce7f3', cornerRadius: 12, fontSize: 14 }),
      card('db', 520, 200, 160, 64, 'Database', { fill: '#fef9c3', cornerRadius: 12, fontSize: 14 }),
    ]),
  },
  {
    id: 'db-diagram', name: 'Database Diagram', category: 'Development', description: 'Tables and relationships',
    keywords: ['database', 'schema', 'sql'],
    build: () => pack([
      card('u', 40, 40, 200, 180, 'users\nid\nemail\nname', { fill: '#fff', stroke: '#6366f1', cornerRadius: 12, fontSize: 14, fontWeight: 'bold', align: 'left', valign: 'top' }),
      card('p', 320, 40, 200, 180, 'posts\nid\nuser_id\ntitle', { fill: '#fff', stroke: '#22c55e', cornerRadius: 12, fontSize: 14, fontWeight: 'bold', align: 'left', valign: 'top' }),
    ]),
  },
  {
    id: 'flowchart', name: 'Flowchart', category: 'Development', description: 'Start, process, decision, end',
    keywords: ['flowchart', 'process'],
    build: () => pack([
      card('s', 280, 20, 160, 48, 'Start', { fill: '#dcfce7', cornerRadius: 24, fontSize: 14 }),
      card('p', 280, 100, 160, 56, 'Process', { fill: '#dbeafe', cornerRadius: 12, fontSize: 14 }),
      card('d', 280, 190, 160, 80, 'Decision?', { fill: '#fef9c3', cornerRadius: 12, fontSize: 14 }),
      card('e', 280, 300, 160, 48, 'End', { fill: '#fecaca', cornerRadius: 24, fontSize: 14 }),
    ]),
  },
  {
    id: 'api-arch', name: 'API Architecture', category: 'Development', description: 'Gateway, services, data stores',
    keywords: ['api', 'gateway', 'microservices'],
    build: () => pack([
      card('g', 40, 120, 160, 80, 'Gateway', { fill: '#e0e7ff', cornerRadius: 12 }),
      card('s1', 280, 40, 160, 80, 'Auth', { fill: '#dbeafe', cornerRadius: 12 }),
      card('s2', 280, 140, 160, 80, 'Core API', { fill: '#dcfce7', cornerRadius: 12 }),
      card('s3', 280, 240, 160, 80, 'Workers', { fill: '#fce7f3', cornerRadius: 12 }),
      card('db', 520, 140, 160, 80, 'Database', { fill: '#fef9c3', cornerRadius: 12 }),
    ]),
  },
]

export function searchTemplates(query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return TEMPLATES
  return TEMPLATES.filter((t) => t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || t.keywords.some((k) => k.includes(q)))
}
