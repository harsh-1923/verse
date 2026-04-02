import { createActor } from 'xstate'
import { appMachine } from './app-machine'

const STORAGE_KEY = 'verse:app-state'

function loadSnapshot() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return undefined
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

function createAppActor() {
  const snapshot = loadSnapshot()
  let actor: ReturnType<typeof createActor<typeof appMachine>>

  try {
    actor = createActor(appMachine, {
      ...(snapshot ? { snapshot } : {}),
    })
  } catch {
    // Stale snapshot doesn't match current machine — start fresh
    localStorage.removeItem(STORAGE_KEY)
    actor = createActor(appMachine)
  }

  actor.subscribe(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(actor.getPersistedSnapshot()))
    } catch {
      // storage full or unavailable
    }
  })

  actor.start()
  return actor
}

// HMR safety: reuse the same actor across hot reloads in development
function getOrCreateActor() {
  if (import.meta.hot) {
    const existing = (globalThis as Record<string, unknown>).__verseAppActor as
      | ReturnType<typeof createAppActor>
      | undefined

    if (existing) return existing

    const actor = createAppActor()
    ;(globalThis as Record<string, unknown>).__verseAppActor = actor

    import.meta.hot.accept(() => {
      // Force a fresh actor on next HMR update
      delete (globalThis as Record<string, unknown>).__verseAppActor
    })

    return actor
  }

  return createAppActor()
}

export const appActor = getOrCreateActor()
