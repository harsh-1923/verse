import { Router, type IRouter, type Request, type Response } from 'express'
import { z } from 'zod'
import { runAgent, type ToolDefinition } from '@verse/pi-agent-core'
import { authMiddleware, optionalAuth as _optionalAuth } from '../middleware/auth.js'
import { writeToDocTool, readSectionTool, replaceRangeTool } from './tools/yjsTools.js'
import { config } from '../config.js'
import { decryptApiKey } from '../crypto.js'

export const agentRouter: IRouter = Router()

const invokeSchema = z.object({
  docId: z.string(),
  prompt: z.string(),
  agentId: z.string(),
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

// Map tool IDs to implementations
const TOOL_MAP: Record<string, ToolDefinition<unknown, unknown>> = {
  write_to_doc: writeToDocTool as ToolDefinition<unknown, unknown>,
  read_section: readSectionTool as ToolDefinition<unknown, unknown>,
  replace_range: replaceRangeTool as ToolDefinition<unknown, unknown>,
}

async function fetchAgent(agentId: string) {
  const res = await fetch(`${config.convexUrl}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: 'agents:getAgentInternal',
      args: { agentId },
      adminKey: config.convexAdminKey,
    }),
  })
  if (!res.ok) return null
  const data = (await res.json()) as { value: unknown }
  return data.value as {
    _id: string
    name: string
    tag: string
    systemPrompt: string
    toolIds: string[]
    provider: string
    model: string
  } | null
}

async function fetchAgentKey(agentId: string): Promise<string | null> {
  const res = await fetch(`${config.convexUrl}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: 'agents:getAgentKeyInternal',
      args: { agentId },
      adminKey: config.convexAdminKey,
    }),
  })
  if (!res.ok) return null
  const data = (await res.json()) as { value: { encryptedKey: string } | null }
  if (!data.value) return null
  return decryptApiKey(data.value.encryptedKey)
}

function addAgentParticipant(docId: string, agentId: string): void {
  if (!config.convexAdminKey) return
  void fetch(`${config.convexUrl}/api/mutation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: 'participants:addParticipantInternal',
      args: { docId, participantId: agentId, participantType: 'agent' },
      adminKey: config.convexAdminKey,
    }),
  }).catch((_e: unknown) => { void _e })
}

agentRouter.post('/invoke', authMiddleware, async (req: Request, res: Response) => {
  const parsed = invokeSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message })
    return
  }
  const { docId, prompt, agentId } = parsed.data

  // 1. Fetch agent definition
  const agent = await fetchAgent(agentId)
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' })
    return
  }

  // 2. Fetch and decrypt API key
  const apiKey = await fetchAgentKey(agentId)
  if (!apiKey) {
    res.status(400).json({ error: 'No API key configured for this agent' })
    return
  }

  // 3. Build system prompt
  const systemPrompt = `${agent.systemPrompt}\n${TOOL_FORMAT_INSTRUCTIONS}\n\nThe current document ID is "${docId}". Always use this exact docId in every tool call.`

  // 4. Filter tools based on agent config
  const tools = agent.toolIds
    .map((id) => TOOL_MAP[id])
    .filter((t): t is ToolDefinition<unknown, unknown> => t !== undefined)

  // 5. Add agent as document participant
  addAgentParticipant(docId, agentId)

  // 6. Set up SSE streaming
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const generator = runAgent({
    docId,
    systemPrompt,
    userMessage: prompt,
    tools,
    llmOptions: {
      provider: agent.provider as 'openai' | 'anthropic' | 'google' | 'groq' | 'litellm',
      model: agent.model,
      apiKey,
      messages: [],
    },
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
    void persistAgentReply(docId, chatContent, agentId)
  }
})

function persistAgentReply(docId: string, content: string, agentId: string): Promise<void> {
  if (!content || !config.convexAdminKey) return Promise.resolve()
  return fetch(`${config.convexUrl}/api/mutation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: 'documents:appendMessageInternal',
      args: { docId, content, authorId: agentId, authorType: 'agent' },
      adminKey: config.convexAdminKey,
    }),
  })
    .then(() => undefined)
    .catch((_e: unknown) => { void _e })
}
