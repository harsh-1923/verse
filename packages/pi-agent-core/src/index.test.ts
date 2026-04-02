import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import type { ToolDefinition, AgentRunEvent } from './index.js'

const mockStreamSimple = vi.fn()

vi.mock('@verse/pi-ai', () => ({
  streamSimple: mockStreamSimple,
}))

async function* makeTokenStream(tokens: string[]) {
  for (const t of tokens) yield t
}

async function collectEvents(gen: AsyncGenerator<AgentRunEvent>): Promise<AgentRunEvent[]> {
  const events: AgentRunEvent[] = []
  for await (const event of gen) {
    events.push(event)
  }
  return events
}

const baseOpts = {
  docId: 'doc-1',
  systemPrompt: 'You are helpful',
  userMessage: 'Hello',
  tools: [] as ToolDefinition[],
  llmOptions: {
    provider: 'openai' as const,
    model: 'gpt-4o',
    apiKey: 'test-key',
    messages: [],
  },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('runAgent', () => {
  it('emits token events and done when no tool calls', async () => {
    mockStreamSimple.mockImplementation(() => makeTokenStream(['Hello', ' there']))

    const { runAgent } = await import('./index.js')
    const events = await collectEvents(runAgent(baseOpts))

    expect(events.filter((e) => e.type === 'token').map((e) => (e as { type: 'token'; payload: string }).payload)).toEqual(['Hello', ' there'])
    expect(events.at(-1)?.type).toBe('done')
  })

  it('parses tool call block and executes tool', async () => {
    const toolResponse = JSON.stringify({ name: 'echo_tool', input: { text: 'hi' } })
    mockStreamSimple
      .mockImplementationOnce(() => makeTokenStream([`\`\`\`tool\n${toolResponse}\n\`\`\``]))
      .mockImplementationOnce(() => makeTokenStream(['Done']))

    const echoTool: ToolDefinition<{ text: string }, { echo: string }> = {
      name: 'echo_tool',
      description: 'Echoes text',
      inputSchema: z.object({ text: z.string() }),
      execute: async ({ text }) => ({ echo: text }),
    }

    const { runAgent } = await import('./index.js')
    const events = await collectEvents(runAgent({ ...baseOpts, tools: [echoTool as ToolDefinition] }))

    const toolCallEvent = events.find((e) => e.type === 'tool_call')
    const toolResultEvent = events.find((e) => e.type === 'tool_result')

    expect(toolCallEvent).toBeDefined()
    expect(toolResultEvent).toBeDefined()
    expect((toolResultEvent as { type: 'tool_result'; payload: { name: string; output: unknown } }).payload.output).toEqual({ echo: 'hi' })
  })

  it('executes multiple tools in parallel', async () => {
    const call1 = JSON.stringify({ name: 'tool_a', input: {} })
    const call2 = JSON.stringify({ name: 'tool_b', input: {} })
    const callBlock = `\`\`\`tool\n${call1}\n\`\`\`\n\`\`\`tool\n${call2}\n\`\`\``

    const executionOrder: string[] = []
    let resolveA!: () => void
    let resolveB!: () => void

    const toolA: ToolDefinition<Record<string, never>, { name: string }> = {
      name: 'tool_a',
      description: 'A',
      inputSchema: z.object({}),
      execute: () =>
        new Promise((resolve) => {
          resolveA = () => {
            executionOrder.push('a')
            resolve({ name: 'a' })
          }
        }),
    }

    const toolB: ToolDefinition<Record<string, never>, { name: string }> = {
      name: 'tool_b',
      description: 'B',
      inputSchema: z.object({}),
      execute: () =>
        new Promise((resolve) => {
          resolveB = () => {
            executionOrder.push('b')
            resolve({ name: 'b' })
          }
        }),
    }

    mockStreamSimple
      .mockImplementationOnce(() => makeTokenStream([callBlock]))
      .mockImplementationOnce(() => makeTokenStream(['Done']))

    const { runAgent } = await import('./index.js')
    const eventsPromise = collectEvents(runAgent({ ...baseOpts, tools: [toolA as ToolDefinition, toolB as ToolDefinition] }))

    await new Promise((r) => setTimeout(r, 10))
    resolveB()
    resolveA()

    const events = await eventsPromise
    const resultEvents = events.filter((e) => e.type === 'tool_result')
    expect(resultEvents).toHaveLength(2)
    expect(executionOrder).toEqual(['b', 'a'])
  })

  it('emits error event on LLM failure', async () => {
    mockStreamSimple.mockImplementation(async () => {
      throw new Error('LLM error')
    })

    const { runAgent } = await import('./index.js')
    const events = await collectEvents(runAgent(baseOpts))

    expect(events.at(-1)?.type).toBe('error')
    expect((events.at(-1) as { type: 'error'; payload: string }).payload).toBe('LLM error')
  })

  it('respects maxIterations and stops after limit', async () => {
    const toolResponse = JSON.stringify({ name: 'infinite_tool', input: {} })
    const callBlock = `\`\`\`tool\n${toolResponse}\n\`\`\``

    mockStreamSimple.mockImplementation(() => makeTokenStream([callBlock]))

    const infiniteTool: ToolDefinition<Record<string, never>, { ok: boolean }> = {
      name: 'infinite_tool',
      description: 'Always returns more tool calls',
      inputSchema: z.object({}),
      execute: async () => ({ ok: true }),
    }

    const { runAgent } = await import('./index.js')
    const events = await collectEvents(runAgent({ ...baseOpts, tools: [infiniteTool as ToolDefinition], maxIterations: 2 }))

    expect(events.at(-1)?.type).toBe('done')
    const callCount = mockStreamSimple.mock.calls.length
    expect(callCount).toBeLessThanOrEqual(2)
  })

  it('handles unknown tool gracefully', async () => {
    const toolResponse = JSON.stringify({ name: 'nonexistent', input: {} })
    mockStreamSimple
      .mockImplementationOnce(() => makeTokenStream([`\`\`\`tool\n${toolResponse}\n\`\`\``]))
      .mockImplementationOnce(() => makeTokenStream(['Done']))

    const { runAgent } = await import('./index.js')
    const events = await collectEvents(runAgent(baseOpts))

    const resultEvent = events.find((e) => e.type === 'tool_result') as
      | { type: 'tool_result'; payload: { name: string; output: unknown } }
      | undefined
    expect(resultEvent).toBeDefined()
    expect(resultEvent?.payload.output).toBeNull()
  })
})
