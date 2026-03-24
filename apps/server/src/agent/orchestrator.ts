import { Router, type IRouter, type Request, type Response } from 'express'
import { z } from 'zod'
import { runAgent, type ToolDefinition } from '@verse/pi-agent-core'
import { authMiddleware, optionalAuth as _optionalAuth } from '../middleware/auth.js'
import { writeToDocTool, readSectionTool, replaceRangeTool } from './tools/yjsTools.js'
import { config } from '../config.js'

export const agentRouter: IRouter = Router()

const invokeSchema = z.object({
  docId: z.string(),
  prompt: z.string(),
  agentName: z.string().optional(),
  provider: z.enum(['openai', 'anthropic', 'google', 'groq', 'litellm']),
  model: z.string(),
  apiKey: z.string(),
  baseUrl: z.string().optional(),
})

const TOOL_FORMAT_INSTRUCTIONS = `
You have access to the following tools to read and edit the shared document:

- write_to_doc(docId, content): Append markdown content to the end of the document.
- read_section(docId, from, to): Read characters [from, to] from the document. Use from=0, to=9999 to read the whole doc.
- replace_range(docId, content): Replace the ENTIRE document with new markdown content.

IMPORTANT: Only use write_to_doc or replace_range when the user explicitly asks you to write, add, create, draft, insert, or update content in the document. For conversational messages — questions, explanations, analysis, casual chat — respond in chat text only without calling any document-writing tools. You may use read_section at any time to look up document content.

To call a tool, output a fenced code block tagged "tool" containing JSON with "name" and "input" keys. Example (replace DOC_ID with the actual document ID provided below):

\`\`\`tool
{"name": "read_section", "input": {"docId": "DOC_ID", "from": 0, "to": 9999}}
\`\`\`

After the tool result is returned, continue your response. You may call multiple tools in sequence.
When you are done editing the document, write a brief chat summary of what you did — do NOT repeat the full document content in the chat.`

const AGENTS: Record<string, string> = {
  jot:
    'You are Jot, a helpful AI assistant embedded in a collaborative markdown editor. ' +
    'You can answer questions, have conversations, and also write content into the document when asked.' +
    TOOL_FORMAT_INSTRUCTIONS,
  verse:
    'You are Verse, a document assistant embedded in a collaborative markdown editor. ' +
    'You can discuss and explain document content, and write summaries or edits into the document when asked.' +
    TOOL_FORMAT_INSTRUCTIONS,
}

agentRouter.post('/invoke', authMiddleware, async (req: Request, res: Response) => {
  const parsed = invokeSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message })
    return
  }
  const { docId, prompt, agentName, provider, model, apiKey, baseUrl } = parsed.data

  const agentBase = (agentName && AGENTS[agentName]) ? AGENTS[agentName] : AGENTS['jot']!
  const systemPrompt = `${agentBase}\n\nThe current document ID is "${docId}". Always use this exact docId in every tool call.`

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: ToolDefinition<any, any>[] = [writeToDocTool, readSectionTool, replaceRangeTool]
  const generator = runAgent({
    docId,
    systemPrompt,
    userMessage: prompt,
    tools,
    llmOptions: { provider, model, apiKey, baseUrl, messages: [] },
  })

  let closed = false
  let fullResponse = ''

  req.on('close', () => {
    closed = true
  })

  try {
    for await (const event of generator) {
      if (closed) break
      if (event.type === 'token') {
        const chunk = event.payload as string
        fullResponse += chunk
        res.write(`data: ${JSON.stringify({ type: 'token', content: chunk })}\n\n`)
      } else if (event.type === 'error') {
        res.write(`data: ${JSON.stringify({ type: 'error', content: event.payload as string })}\n\n`)
      }
    }
  } finally {
    res.write('data: [DONE]\n\n')
    res.end()
    const chatContent = fullResponse.replace(/```tool[\s\S]*?```/g, '').trim()
    void persistAgentReply(docId, chatContent, agentName ?? 'jot')
  }
})

function persistAgentReply(docId: string, content: string, agentName: string): Promise<void> {
  if (!content || !config.convexAdminKey) return Promise.resolve()
  return fetch(`${config.convexUrl}/api/mutation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: 'documents:appendAgentMessageInternal',
      args: { docId, role: 'assistant', content, authorName: agentName },
      adminKey: config.convexAdminKey,
    }),
  })
    .then(() => undefined)
    .catch((_e: unknown) => { void _e })
}
