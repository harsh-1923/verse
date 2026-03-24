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
    return ctx.db.insert('documents', {
      title: args.title,
      ownerId: userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
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

export const appendAgentMessage = mutation({
  args: {
    docId: v.string(),
    role: v.union(v.literal('user'), v.literal('assistant')),
    content: v.string(),
    authorName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error('Unauthenticated')
    const user = await ctx.db.get(userId)
    const resolvedName = user?.name ?? user?.email ?? args.authorName
    await ctx.db.insert('agentMessages', {
      docId: args.docId,
      role: args.role,
      content: args.content,
      authorName: resolvedName,
      timestamp: Date.now(),
    })
  },
})

export const appendAgentMessageInternal = mutation({
  args: {
    docId: v.string(),
    role: v.union(v.literal('user'), v.literal('assistant')),
    content: v.string(),
    authorName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('agentMessages', {
      docId: args.docId,
      role: args.role,
      content: args.content,
      authorName: args.authorName,
      timestamp: Date.now(),
    })
  },
})

export const getAgentHistory = query({
  args: { docId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    return ctx.db
      .query('agentMessages')
      .filter((q) => q.eq(q.field('docId'), args.docId))
      .collect()
  },
})
