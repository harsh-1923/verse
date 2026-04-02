import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'

const participantTypeValidator = v.union(v.literal('user'), v.literal('agent'))

// --- Queries ---

export const getDocParticipants = query({
  args: { docId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const participants = await ctx.db
      .query('documentParticipants')
      .withIndex('by_doc', (q) => q.eq('docId', args.docId))
      .collect()

    // Resolve participant details
    const enriched = await Promise.all(
      participants.map(async (p) => {
        if (p.participantType === 'user') {
          const user = await ctx.db.get(p.participantId as never)
          return {
            ...p,
            name: (user as { name?: string; email?: string } | null)?.name ??
              (user as { name?: string; email?: string } | null)?.email ?? 'User',
            avatarUrl: undefined as string | undefined,
          }
        } else {
          const agent = await ctx.db.get(p.participantId as never)
          return {
            ...p,
            name: (agent as { name?: string } | null)?.name ?? 'Agent',
            avatarUrl: (agent as { avatarUrl?: string } | null)?.avatarUrl,
          }
        }
      }),
    )

    return enriched
  },
})

// --- Mutations ---

export const addParticipant = mutation({
  args: {
    docId: v.string(),
    participantId: v.string(),
    participantType: participantTypeValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error('Unauthenticated')

    // Check if already a participant
    const existing = await ctx.db
      .query('documentParticipants')
      .withIndex('by_doc', (q) => q.eq('docId', args.docId))
      .filter((q) => q.eq(q.field('participantId'), args.participantId))
      .first()
    if (existing) return existing._id

    return ctx.db.insert('documentParticipants', {
      docId: args.docId,
      participantId: args.participantId,
      participantType: args.participantType,
      joinedAt: Date.now(),
    })
  },
})

export const addParticipantInternal = mutation({
  args: {
    docId: v.string(),
    participantId: v.string(),
    participantType: participantTypeValidator,
  },
  handler: async (ctx, args) => {
    // Check if already a participant
    const existing = await ctx.db
      .query('documentParticipants')
      .withIndex('by_doc', (q) => q.eq('docId', args.docId))
      .filter((q) => q.eq(q.field('participantId'), args.participantId))
      .first()
    if (existing) return existing._id

    return ctx.db.insert('documentParticipants', {
      docId: args.docId,
      participantId: args.participantId,
      participantType: args.participantType,
      joinedAt: Date.now(),
    })
  },
})

export const removeParticipant = mutation({
  args: {
    docId: v.string(),
    participantId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error('Unauthenticated')

    // Only doc owner can remove participants
    const doc = await ctx.db
      .query('documents')
      .filter((q) => q.eq(q.field('_id'), args.docId))
      .first()
    if (!doc || doc.ownerId !== userId) throw new Error('Not authorized')

    const participant = await ctx.db
      .query('documentParticipants')
      .withIndex('by_doc', (q) => q.eq('docId', args.docId))
      .filter((q) => q.eq(q.field('participantId'), args.participantId))
      .first()
    if (participant) {
      await ctx.db.delete(participant._id)
    }
  },
})
