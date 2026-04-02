import type { SnapshotFrom } from 'xstate'
import type { appMachine } from './app-machine'

type AppSnapshot = SnapshotFrom<typeof appMachine>

export const selectOpenDocs = (snap: AppSnapshot) => snap.context.openDocs
export const selectCurrentDocId = (snap: AppSnapshot) => snap.context.currentDocId
export const selectRecentDocs = (snap: AppSnapshot) => snap.context.recentDocs
export const selectShowDir = (snap: AppSnapshot) => snap.context.showDir
export const selectIsZen = (snap: AppSnapshot) => snap.context.zenMode
export const selectIsIdle = (snap: AppSnapshot) => snap.context.openDocs.length === 0

export const selectCurrentDoc = (snap: AppSnapshot) => {
  const id = snap.context.currentDocId
  return snap.context.openDocs.find(d => d.id === id) ?? null
}

export const selectShowDirEffective = (snap: AppSnapshot) =>
  snap.context.showDir && !snap.context.zenMode

export const selectShowChatEffective = (snap: AppSnapshot) => {
  const doc = selectCurrentDoc(snap)
  return doc?.showChat === true && !snap.context.zenMode
}
