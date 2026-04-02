import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const user = await ctx.db.get(userId)
    if (!user) return null
    return { name: user.name ?? user.email ?? 'User' }
  },
})

export const listDocuments = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    return ctx.db
      .query('documents')
      .withIndex('by_owner', (q) => q.eq('ownerId', userId))
      .order('desc')
      .collect()
  },
})

export const getDocument = query({
  args: { docId: v.id('documents') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    const doc = await ctx.db.get(args.docId)
    if (!doc) return null
    return doc
  },
})

export const createDocument = mutation({
  args: { title: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error('Unauthenticated')
    const docId = await ctx.db.insert('documents', {
      title: args.title,
      ownerId: userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    // Add creator as participant
    await ctx.db.insert('documentParticipants', {
      docId,
      participantId: userId,
      participantType: 'user',
      joinedAt: Date.now(),
    })
    return docId
  },
})

export const updateDocument = mutation({
  args: { docId: v.id('documents'), title: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error('Unauthenticated')
    const doc = await ctx.db.get(args.docId)
    if (!doc || doc.ownerId !== userId) throw new Error('Not found')
    await ctx.db.patch(args.docId, { title: args.title, updatedAt: Date.now() })
  },
})

export const deleteDocument = mutation({
  args: { docId: v.id('documents') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error('Unauthenticated')
    const doc = await ctx.db.get(args.docId)
    if (!doc || doc.ownerId !== userId) throw new Error('Not found')

    // Cascade delete participants
    const participants = await ctx.db
      .query('documentParticipants')
      .withIndex('by_doc', (q) => q.eq('docId', args.docId))
      .collect()
    for (const p of participants) {
      await ctx.db.delete(p._id)
    }

    // Cascade delete messages
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_doc', (q) => q.eq('docId', args.docId))
      .collect()
    for (const m of messages) {
      await ctx.db.delete(m._id)
    }

    // Cascade delete Yjs snapshots
    const snapshots = await ctx.db
      .query('yjsSnapshots')
      .filter((q) => q.eq(q.field('docId'), args.docId))
      .collect()
    for (const s of snapshots) {
      await ctx.db.delete(s._id)
    }

    await ctx.db.delete(args.docId)
  },
})

export const saveYjsSnapshot = mutation({
  args: { docId: v.string(), update: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('yjsSnapshots')
      .filter((q) => q.eq(q.field('docId'), args.docId))
      .first()
    if (existing) {
      await ctx.db.patch(existing._id, { update: args.update, savedAt: Date.now() })
    } else {
      await ctx.db.insert('yjsSnapshots', { docId: args.docId, update: args.update, savedAt: Date.now() })
    }
  },
})

export const getYjsSnapshot = query({
  args: { docId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query('yjsSnapshots')
      .filter((q) => q.eq(q.field('docId'), args.docId))
      .first()
  },
})

// --- Messages ---

export const appendMessage = mutation({
  args: {
    docId: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error('Unauthenticated')
    await ctx.db.insert('messages', {
      docId: args.docId,
      content: args.content,
      authorId: userId,
      authorType: 'user',
      timestamp: Date.now(),
    })
  },
})

export const appendMessageInternal = mutation({
  args: {
    docId: v.string(),
    content: v.string(),
    authorId: v.string(),
    authorType: v.union(v.literal('user'), v.literal('agent')),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('messages', {
      docId: args.docId,
      content: args.content,
      authorId: args.authorId,
      authorType: args.authorType,
      timestamp: Date.now(),
    })
  },
})

export const getMessageHistory = query({
  args: { docId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_doc', (q) => q.eq('docId', args.docId))
      .collect()

    // Resolve author names
    const enriched = await Promise.all(
      messages.map(async (msg) => {
        if (msg.authorType === 'user') {
          const user = await ctx.db.get(msg.authorId as never)
          return {
            ...msg,
            authorName: (user as { name?: string; email?: string } | null)?.name ??
              (user as { name?: string; email?: string } | null)?.email ?? 'User',
          }
        } else {
          const agent = await ctx.db.get(msg.authorId as never)
          return {
            ...msg,
            authorName: (agent as { name?: string } | null)?.name ?? 'Agent',
          }
        }
      }),
    )

    return enriched
  },
})
