import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'

const providerValidator = v.union(
  v.literal('openai'),
  v.literal('anthropic'),
  v.literal('google'),
  v.literal('groq'),
  v.literal('litellm'),
)

// --- Queries ---

export const listAgents = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    const userAgents = await ctx.db
      .query('agents')
      .withIndex('by_creator', (q) => q.eq('createdBy', userId))
      .collect()
    const builtInAgents = await ctx.db
      .query('agents')
      .filter((q) => q.eq(q.field('builtIn'), true))
      .collect()
    const seen = new Set(userAgents.map((a) => a._id))
    for (const agent of builtInAgents) {
      if (!seen.has(agent._id)) {
        userAgents.push(agent)
      }
    }
    return userAgents
  },
})

export const getAgent = query({
  args: { agentId: v.id('agents') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    return ctx.db.get(args.agentId)
  },
})

export const getAgentByTag = query({
  args: { tag: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const agent = await ctx.db
      .query('agents')
      .withIndex('by_tag', (q) => q.eq('createdBy', userId).eq('tag', args.tag))
      .unique()
    if (agent) return agent
    // Fall back to built-in agents
    return ctx.db
      .query('agents')
      .filter((q) =>
        q.and(q.eq(q.field('tag'), args.tag), q.eq(q.field('builtIn'), true)),
      )
      .first()
  },
})

// Internal queries (called via admin key from server)

export const getAgentInternal = query({
  args: { agentId: v.id('agents') },
  handler: async (ctx, args) => {
    return ctx.db.get(args.agentId)
  },
})

export const getAgentKeyInternal = query({
  args: { agentId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query('agentKeys')
      .withIndex('by_agent', (q) => q.eq('agentId', args.agentId))
      .first()
  },
})

// --- Mutations ---

export const createAgent = mutation({
  args: {
    name: v.string(),
    tag: v.string(),
    description: v.string(),
    avatarUrl: v.optional(v.string()),
    systemPrompt: v.string(),
    toolIds: v.array(v.string()),
    provider: providerValidator,
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error('Unauthenticated')

    // Validate tag uniqueness per user
    const existing = await ctx.db
      .query('agents')
      .withIndex('by_tag', (q) => q.eq('createdBy', userId).eq('tag', args.tag))
      .unique()
    if (existing) throw new Error(`Agent with tag "${args.tag}" already exists`)

    return ctx.db.insert('agents', {
      ...args,
      builtIn: false,
      createdBy: userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
})

export const updateAgent = mutation({
  args: {
    agentId: v.id('agents'),
    name: v.optional(v.string()),
    tag: v.optional(v.string()),
    description: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    toolIds: v.optional(v.array(v.string())),
    provider: v.optional(providerValidator),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error('Unauthenticated')

    const agent = await ctx.db.get(args.agentId)
    if (!agent) throw new Error('Not found')
    if (agent.builtIn) throw new Error('Cannot modify built-in agents')
    if (agent.createdBy !== userId) throw new Error('Not authorized')

    // If tag is changing, validate uniqueness
    if (args.tag && args.tag !== agent.tag) {
      const existing = await ctx.db
        .query('agents')
        .withIndex('by_tag', (q) =>
          q.eq('createdBy', userId).eq('tag', args.tag!),
        )
        .unique()
      if (existing) throw new Error(`Agent with tag "${args.tag}" already exists`)
    }

    const { agentId: _, ...updates } = args
    const fields: Record<string, unknown> = { updatedAt: Date.now() }
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) fields[key] = value
    }
    await ctx.db.patch(args.agentId, fields)
  },
})

export const deleteAgent = mutation({
  args: { agentId: v.id('agents') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error('Unauthenticated')

    const agent = await ctx.db.get(args.agentId)
    if (!agent) throw new Error('Not found')
    if (agent.builtIn) throw new Error('Cannot delete built-in agents')
    if (agent.createdBy !== userId) throw new Error('Not authorized')

    // Delete associated key
    const key = await ctx.db
      .query('agentKeys')
      .withIndex('by_agent', (q) => q.eq('agentId', args.agentId))
      .first()
    if (key) await ctx.db.delete(key._id)

    await ctx.db.delete(args.agentId)
  },
})

export const upsertAgentKey = mutation({
  args: {
    agentId: v.id('agents'),
    encryptedKey: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error('Unauthenticated')

    const agent = await ctx.db.get(args.agentId)
    if (!agent) throw new Error('Not found')
    if (!agent.builtIn && agent.createdBy !== userId) throw new Error('Not authorized')

    const existing = await ctx.db
      .query('agentKeys')
      .withIndex('by_agent', (q) => q.eq('agentId', args.agentId))
      .first()

    const now = Date.now()
    if (existing) {
      await ctx.db.patch(existing._id, {
        encryptedKey: args.encryptedKey,
        updatedAt: now,
      })
    } else {
      await ctx.db.insert('agentKeys', {
        agentId: args.agentId,
        encryptedKey: args.encryptedKey,
        createdAt: now,
        updatedAt: now,
      })
    }
  },
})
