import { mutation } from './_generated/server'

const BUILT_IN_AGENTS = [
  {
    name: 'Jot',
    tag: 'jot',
    description: 'A helpful AI assistant for writing and editing documents.',
    systemPrompt:
      'You are Jot, a helpful AI assistant embedded in a collaborative markdown editor. ' +
      'You can answer questions, have conversations, and also write content into the document when asked.',
    toolIds: ['write_to_doc', 'read_section', 'replace_range'],
    provider: 'anthropic' as const,
    model: 'claude-sonnet-4-6',
  },
  {
    name: 'Verse',
    tag: 'verse',
    description: 'A document assistant for discussing and summarizing content.',
    systemPrompt:
      'You are Verse, a document assistant embedded in a collaborative markdown editor. ' +
      'You can discuss and explain document content, and write summaries or edits into the document when asked.',
    toolIds: ['write_to_doc', 'read_section', 'replace_range'],
    provider: 'anthropic' as const,
    model: 'claude-sonnet-4-6',
  },
]

export const seedBuiltInAgents = mutation({
  args: {},
  handler: async (ctx) => {
    for (const agent of BUILT_IN_AGENTS) {
      // Check if already exists
      const existing = await ctx.db
        .query('agents')
        .filter((q) =>
          q.and(q.eq(q.field('tag'), agent.tag), q.eq(q.field('builtIn'), true)),
        )
        .first()
      if (existing) continue

      await ctx.db.insert('agents', {
        ...agent,
        builtIn: true,
        createdBy: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    }
  },
})
