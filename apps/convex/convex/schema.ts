import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { authTables } from '@convex-dev/auth/server'

export default defineSchema({
  ...authTables,
  documents: defineTable({
    title: v.string(),
    ownerId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_owner', ['ownerId']),
  yjsSnapshots: defineTable({
    docId: v.string(),
    update: v.string(),
    savedAt: v.number(),
  }),
  agentMessages: defineTable({
    docId: v.string(),
    role: v.union(v.literal('user'), v.literal('assistant')),
    content: v.string(),
    authorName: v.optional(v.string()),
    timestamp: v.number(),
  }),
})
