import type { ZodSchema } from 'zod'
import type { StreamSimpleOptions } from '@verse/pi-ai'

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string
  description: string
  inputSchema: ZodSchema<TInput>
  execute: (input: TInput) => Promise<TOutput>
}

export interface AgentRunOptions {
  docId: string
  systemPrompt: string
  userMessage: string
  tools: ToolDefinition[]
  llmOptions: StreamSimpleOptions
  maxIterations?: number
}

export type AgentRunEvent =
  | { type: 'token'; payload: string }
  | { type: 'tool_call'; payload: { name: string; input: unknown } }
  | { type: 'tool_result'; payload: { name: string; output: unknown } }
  | { type: 'done'; payload: string }
  | { type: 'error'; payload: string }
