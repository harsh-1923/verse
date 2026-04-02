import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import type { FormEvent } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { anyApi } from 'convex/server'
import type { AgentInvokeRequest, AgentInvokeChunk, DocId } from '@verse/types'
import { AgentDialog } from './CreateAgentDialog'
import { Plus } from 'lucide-react'

function stripToolBlocks(text: string): string {
  let result = text.replace(/```tool[\s\S]*?```/g, '')
  const openIdx = result.lastIndexOf('```tool')
  if (openIdx !== -1) result = result.slice(0, openIdx)
  return result.trim()
}

interface AgentPanelProps {
  docId: string
  token?: string
}

interface EnrichedMessage {
  _id: string
  docId: string
  content: string
  authorId: string
  authorType: 'user' | 'agent'
  authorName: string
  timestamp: number
}

interface AgentDef {
  _id: string
  name: string
  tag: string
  description: string
  avatarUrl?: string
}

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3000'

export const AgentPanel = ({ docId, token }: AgentPanelProps) => {
  const [prompt, setPrompt] = useState('')
  const [streamingContent, setStreamingContent] = useState<string | null>(null)
  const [streamingAgentName, setStreamingAgentName] = useState<string>('Agent')
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const history = useQuery(anyApi.documents.getMessageHistory, { docId }) as EnrichedMessage[] | undefined
  const appendMessage = useMutation(anyApi.documents.appendMessage)
  const agents = useQuery(anyApi.agents.listAgents) as AgentDef[] | undefined

  const agentTagMap = useMemo(() => {
    const map = new Map<string, AgentDef>()
    if (agents) {
      for (const agent of agents) {
        map.set(agent.tag.toLowerCase(), agent)
      }
    }
    return map
  }, [agents])

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [history, streamingContent, scrollToBottom])

  const parseAgentMention = useCallback(
    (text: string): AgentDef | null => {
      const match = text.match(/^@(\S+)\b/i)
      if (!match) return null
      return agentTagMap.get(match[1]!.toLowerCase()) ?? null
    },
    [agentTagMap],
  )

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    const text = prompt.trim()
    if (!text || loading) return

    setPrompt('')

    try {
      await appendMessage({ docId, content: text })
    } catch (_e) {
      void _e
    }

    const agent = parseAgentMention(text)
    if (!agent) return

    setLoading(true)
    setStreamingContent('')
    setStreamingAgentName(agent.name)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const body: AgentInvokeRequest = {
        docId: docId as DocId,
        prompt: text,
        agentId: agent._id,
      }

      console.log('[agent:request]', body)
      const res = await fetch(`${SERVER_URL}/agent/invoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      console.log('[agent:response]', { status: res.status, ok: res.ok })
      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => '')
        throw new Error(`Server error ${res.status}: ${errText}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') break

          try {
            const chunk = JSON.parse(raw) as AgentInvokeChunk
            console.log('[agent:chunk]', chunk)
            if (chunk.type === 'token') {
              setStreamingContent(prev => (prev ?? '') + chunk.content)
            }
          } catch {
            void 0
          }
        }
      }
    } catch (err) {
      console.error('[agent:error]', err)
      if ((err as Error).name !== 'AbortError') {
        const msg = err instanceof Error ? err.message : String(err)
        setStreamingContent(`\u26a0\ufe0f ${msg}`)
      }
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }, [prompt, loading, docId, token, appendMessage, parseAgentMention])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const messages = history ?? []
  const agentTags = agents?.map((a) => `@${a.tag}`).join(', ') ?? ''

  return (
    <div className="flex flex-col h-full bg-[#f9fafb]" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#e7ecf1] bg-white">
        <span className="text-sm font-semibold text-[#1a1c1d]">Chat</span>
        <AgentDialog>
          <button className="flex items-center gap-1.5 text-xs font-medium text-[#6b7785] hover:text-[#1a1c1d] transition-colors">
            <Plus size={14} />
            New Agent
          </button>
        </AgentDialog>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {messages.length === 0 && !streamingContent && (
          <p className="text-[13px] text-[#8fa0b1] text-center pt-8">
            {agentTags
              ? <>Mention {agentTags} to invoke an agent.</>
              : <>No agents configured. Create one in settings.</>
            }
          </p>
        )}
        {messages.map((msg: EnrichedMessage) => (
          <div key={msg._id} className="flex gap-3">
            {msg.authorType === 'user' ? (
              <div className="w-5 h-5 rounded-full bg-[#bfe6d1] shrink-0 flex items-center justify-center text-[10px] font-semibold text-[#1a1c1d]">
                {(msg.authorName ?? 'U')[0]?.toUpperCase()}
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full bg-[#f98047] shrink-0 flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[14px] font-semibold text-[#1a1c1d]">
                  {msg.authorName}
                </span>
              </div>
              <div className={`text-[15px] leading-snug whitespace-pre-wrap break-words ${
                msg.authorType === 'user'
                  ? 'text-[#1a1c1d]'
                  : 'bg-white rounded-lg p-3 text-[14px] text-[#585d62] border border-[#e7ecf1] shadow-sm mt-2'
              }`}>
                {stripToolBlocks(msg.content)}
              </div>
            </div>
          </div>
        ))}

        {streamingContent !== null && (
          <div className="flex gap-3">
            <div className="w-5 h-5 rounded-full bg-[#f98047] shrink-0 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[14px] font-semibold text-[#1a1c1d]">{streamingAgentName}</span>
              </div>
              <div className="bg-white rounded-lg p-3 text-[14px] text-[#585d62] border border-[#e7ecf1] shadow-sm mt-2 whitespace-pre-wrap break-words">
                {stripToolBlocks(streamingContent)}
                <span className="inline-block w-[6px] h-[14px] ml-1 bg-[#f98047] animate-pulse align-middle" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="shrink-0 bg-white border-t border-[#e7ecf1] px-4 pt-3 pb-4 rounded-t-xl mx-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void handleSubmit(e as unknown as FormEvent)
            }
          }}
          placeholder={agentTags ? `Type a message, or ${agentTags} to invoke an agent...` : 'Type a message...'}
          rows={1}
          disabled={loading}
          className="w-full text-[15px] bg-transparent text-[#1a1c1d] placeholder-[#8fa0b1] resize-none focus:outline-none disabled:opacity-50 min-h-[44px]"
        />
        <div className="flex justify-between items-center mt-2">
          <button type="button" className="p-1.5 text-[#8fa0b1] hover:text-[#1a1c1d] transition-colors rounded-full hover:bg-[#f9fafb]">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
          {loading ? (
            <button
              type="button"
              onClick={handleStop}
              className="p-1.5 text-red-500 hover:bg-red-50 rounded-full transition-colors"
              title="Stop generating"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="6" y="6" width="12" height="12" rx="2" ry="2" />
              </svg>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!prompt.trim()}
              className={`p-1.5 rounded-full transition-colors ${
                prompt.trim() ? 'text-[#f98047] hover:bg-[#ffddd4]' : 'text-[#a3abaf] cursor-not-allowed'
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
