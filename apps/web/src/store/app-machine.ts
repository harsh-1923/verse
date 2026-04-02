import { setup, assign } from 'xstate'
import { toast } from 'sonner'

// ── Types ────────────────────────────────────────────

export interface DocTab {
  id: string
  title: string
  showChat: boolean
}

export interface RecentDoc {
  id: string
  title: string
  visitedAt: number
}

export interface AppContext {
  openDocs: DocTab[]
  currentDocId: string | null
  recentDocs: RecentDoc[]
  showDir: boolean
  zenMode: boolean
}

export type AppEvent =
  | { type: 'doc.open'; id: string; title: string }
  | { type: 'doc.close'; id: string }
  | { type: 'doc.switch'; id: string }
  | { type: 'doc.reorder'; from: number; to: number }
  | { type: 'dir.toggle' }
  | { type: 'chat.toggle' }
  | { type: 'zen.toggle' }

// ── Helpers ──────────────────────────────────────────

function pushRecent(recentDocs: RecentDoc[], id: string, title: string): RecentDoc[] {
  const filtered = recentDocs.filter(d => d.id !== id)
  return [{ id, title, visitedAt: Date.now() }, ...filtered].slice(0, 20)
}

// ── Machine ──────────────────────────────────────────

export const appMachine = setup({
  types: {
    context: {} as AppContext,
    events: {} as AppEvent,
  },

  guards: {
    isInOpenDocs: ({ context, event }) =>
      event.type === 'doc.switch' &&
      context.openDocs.some(d => d.id === event.id),

    hasCurrentDoc: ({ context }) =>
      context.currentDocId !== null,
  },

  actions: {
    openDoc: assign(({ context, event }) => {
      if (event.type !== 'doc.open') return {}
      const exists = context.openDocs.some(d => d.id === event.id)
      return {
        openDocs: exists
          ? context.openDocs.map(d => d.id === event.id ? { ...d, title: event.title } : d)
          : [...context.openDocs, { id: event.id, title: event.title, showChat: false }],
        currentDocId: event.id,
        recentDocs: pushRecent(
          context.recentDocs,
          event.id,
          event.title,
        ),
      }
    }),

    closeDoc: assign(({ context, event }) => {
      if (event.type !== 'doc.close') return {}
      const idx = context.openDocs.findIndex(d => d.id === event.id)
      const remaining = context.openDocs.filter(d => d.id !== event.id)

      let currentDocId = context.currentDocId
      if (context.currentDocId === event.id) {
        if (remaining.length > 0) {
          currentDocId = remaining[Math.min(idx, remaining.length - 1)].id
        } else {
          currentDocId = null
        }
      }

      return { openDocs: remaining, currentDocId }
    }),

    switchDoc: assign(({ context, event }) => {
      if (event.type !== 'doc.switch') return {}
      const title = context.openDocs.find(d => d.id === event.id)?.title ?? ''
      return {
        currentDocId: event.id,
        recentDocs: pushRecent(context.recentDocs, event.id, title),
      }
    }),

    reorderDocs: assign(({ context, event }) => {
      if (event.type !== 'doc.reorder') return {}
      const docs = [...context.openDocs]
      const [moved] = docs.splice(event.from, 1)
      docs.splice(event.to, 0, moved)
      return { openDocs: docs }
    }),

    toggleDir: assign(({ context }) => {
      const next = !context.showDir
      toast(next ? 'Sidebar visible' : 'Sidebar hidden')
      return { showDir: next }
    }),

    toggleChat: assign(({ context }) => {
      const current = context.openDocs.find(d => d.id === context.currentDocId)
      const next = current ? !current.showChat : false
      toast(next ? 'Chat opened' : 'Chat closed')
      return {
        openDocs: context.openDocs.map(d =>
          d.id === context.currentDocId
            ? { ...d, showChat: next }
            : d
        ),
      }
    }),

    toggleZen: assign(({ context }) => {
      const next = !context.zenMode
      toast(next ? 'Zen mode on' : 'Zen mode off')
      return { zenMode: next }
    }),
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QEMAOqDEED2BjAdNqmAHYDaADALqKirawCWALo9ibSAB6IDMvAVnwAmAOwBOYQInjJARgECANCACeiACwAOYfh1aBgwQDZjo4xVEBfKyrSYcBXABsGYSjSQh6TVu048CAC0GuL4GsJyvMIWcpFyOgoq6giiFEJavOICUcZxhsY2duhYePiwAO4suAAWHpw+LGwcXoEa6fgUWnKioloaxjl9Wsl8UuHCvBqKxloUChpFIPalBABOYNhrEGBr9V6Nfi2ggcIR+OLpU8LC4rxy2gIjaogxupemhme8FJcKSysIIw1vhmNgoFBnO5qA0GE1-K0+OINHpjKFMvdsqJJqMEA8hANZNltBZDNMASVashmKDwZDoZ46HCjgFEEFJhR8NE8rdzN1jFlhLjFCJIhoJJZsYpybZliUAF6kWkQqH7Jm+ZqsvHY-BybLSXhzPqiKK4oKiITItIGcTY2KmGyykjYHbwLz2WEahEnRCmfACCj8KSS4RaZ4pPIZYSB9LiB6SMOOqxAA */
  id: 'app',
  context: {
    openDocs: [],
    currentDocId: null,
    recentDocs: [],
    showDir: true,
    zenMode: false,
  },

  on: {
    'doc.open': {
      actions: ['openDoc'],
    },
    'doc.close': {
      actions: ['closeDoc'],
    },
    'doc.switch': {
      guard: 'isInOpenDocs',
      actions: ['switchDoc'],
    },
    'doc.reorder': {
      actions: ['reorderDocs'],
    },
    'dir.toggle': {
      actions: ['toggleDir'],
    },
    'chat.toggle': {
      guard: 'hasCurrentDoc',
      actions: ['toggleChat'],
    },
    'zen.toggle': {
      actions: ['toggleZen'],
    },
  },
})
