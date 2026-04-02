import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { authTables } from '@convex-dev/auth/server'

const providerValidator = v.union(
  v.literal('openai'),
  v.literal('anthropic'),
  v.literal('google'),
  v.literal('groq'),
  v.literal('litellm'),
)

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
  agents: defineTable({
    name: v.string(),
    tag: v.string(),
    description: v.string(),
    avatarUrl: v.optional(v.string()),
    systemPrompt: v.string(),
    toolIds: v.array(v.string()),
    provider: providerValidator,
    model: v.string(),
    builtIn: v.boolean(),
    createdBy: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_creator', ['createdBy'])
    .index('by_tag', ['createdBy', 'tag']),
  agentKeys: defineTable({
    agentId: v.string(),
    encryptedKey: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_agent', ['agentId']),
  messages: defineTable({
    docId: v.string(),
    content: v.string(),
    authorId: v.string(),
    authorType: v.union(v.literal('user'), v.literal('agent')),
    timestamp: v.number(),
  }).index('by_doc', ['docId']),
  documentParticipants: defineTable({
    docId: v.string(),
    participantId: v.string(),
    participantType: v.union(v.literal('user'), v.literal('agent')),
    joinedAt: v.number(),
  })
    .index('by_doc', ['docId'])
    .index('by_participant', ['participantId']),
})
