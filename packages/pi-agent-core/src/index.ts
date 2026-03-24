import { streamSimple } from '@verse/pi-ai'
import type { AgentRunOptions, AgentRunEvent, ToolDefinition } from './types.js'

export type { ToolDefinition, AgentRunOptions, AgentRunEvent }

const TOOL_CALL_REGEX = /```tool\n([\s\S]*?)\n```/g

interface ToolCall {
  name: string
  input: unknown
}

function parseToolCalls(text: string): ToolCall[] {
  const calls: ToolCall[] = []
  let match: RegExpExecArray | null
  TOOL_CALL_REGEX.lastIndex = 0
  while ((match = TOOL_CALL_REGEX.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]) as { name: string; input: unknown }
      if (typeof parsed.name === 'string') {
        calls.push({ name: parsed.name, input: parsed.input ?? {} })
      }
    } catch (_e) {
      void _e
    }
  }
  return calls
}

async function executeToolCall(
  call: ToolCall,
  tools: ToolDefinition[],
): Promise<{ name: string; output: unknown; error?: string }> {
  const tool = tools.find((t) => t.name === call.name)
  if (!tool) {
    return { name: call.name, output: null, error: `Unknown tool: ${call.name}` }
  }
  const parsed = tool.inputSchema.safeParse(call.input)
  if (!parsed.success) {
    return { name: call.name, output: null, error: parsed.error.message }
  }
  const output = await tool.execute(parsed.data)
  return { name: call.name, output }
}

export async function* runAgent(opts: AgentRunOptions): AsyncGenerator<AgentRunEvent> {
  const { systemPrompt, userMessage, tools, llmOptions, maxIterations = 10 } = opts

  const messages: { role: 'user' | 'assistant' | 'system'; content: string }[] = [
    ...(llmOptions.messages ?? []),
    { role: 'user', content: userMessage },
  ]

  let iterations = 0

  try {
    while (iterations < maxIterations) {
      iterations++
      let assistantText = ''

      for await (const chunk of streamSimple({ ...llmOptions, messages, system: systemPrompt })) {
        assistantText += chunk
        yield { type: 'token', payload: chunk }
      }

      messages.push({ role: 'assistant', content: assistantText })

      const toolCalls = parseToolCalls(assistantText)
      if (toolCalls.length === 0) {
        yield { type: 'done', payload: assistantText }
        return
      }

      for (const call of toolCalls) {
        yield { type: 'tool_call', payload: { name: call.name, input: call.input } }
      }

      const results = await Promise.all(toolCalls.map((call) => executeToolCall(call, tools)))

      const toolResultParts: string[] = []
      for (const result of results) {
        yield { type: 'tool_result', payload: { name: result.name, output: result.output } }
        toolResultParts.push(
          `Tool: ${result.name}\n${result.error ? `Error: ${result.error}` : `Result: ${JSON.stringify(result.output)}`}`,
        )
      }

      messages.push({ role: 'user', content: toolResultParts.join('\n\n') })
    }

    yield { type: 'done', payload: messages.at(-1)?.content ?? '' }
  } catch (err) {
    yield { type: 'error', payload: err instanceof Error ? err.message : String(err) }
  }
}
