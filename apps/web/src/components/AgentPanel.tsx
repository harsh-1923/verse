import { useState, useRef, useCallback, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { anyApi } from 'convex/server'
import type { AgentInvokeRequest, AgentInvokeChunk, DocId } from '@verse/types'

function stripToolBlocks(text: string): string {
  let result = text.replace(/```tool[\s\S]*?```/g, '')
  const openIdx = result.lastIndexOf('```tool')
  if (openIdx !== -1) result = result.slice(0, openIdx)
  return result.trim()
}

interface AgentPanelProps {
  docId: string
  token?: string
  authorName?: string
}

interface AgentMessage {
  _id: string
  docId: string
  role: 'user' | 'assistant'
  content: string
  authorName?: string
  timestamp: number
}

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3000'

const PROVIDERS = ['openai', 'anthropic', 'google', 'groq', 'litellm'] as const
type Provider = (typeof PROVIDERS)[number]

const MODELS: Record<Provider, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-3-5'],
  google: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
  litellm: [],
}

type AgentName = 'jot' | 'verse'

function parseAgentMention(text: string): AgentName | null {
  const match = text.match(/^@(jot|verse)\b/i)
  if (!match) return null
  return match[1]!.toLowerCase() as AgentName
}

export function AgentPanel({ docId, token, authorName }: AgentPanelProps) {
  const [provider, setProvider] = useState<Provider>('openai')
  const [model, setModel] = useState(MODELS.openai[0])
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [prompt, setPrompt] = useState('')
  const [streamingContent, setStreamingContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const history = useQuery(anyApi.documents.getAgentHistory, { docId }) as AgentMessage[] | undefined
  const appendMessage = useMutation(anyApi.documents.appendAgentMessage)

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [history, streamingContent, scrollToBottom])

  const handleProviderChange = useCallback((p: Provider) => {
    setProvider(p)
    setModel(MODELS[p][0] ?? '')
  }, [])

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    const text = prompt.trim()
    if (!text || loading) return

    setPrompt('')

    try {
      await appendMessage({ docId, role: 'user', content: text, authorName: authorName ?? 'You' })
    } catch (_e) {
      void _e
    }

    const agentName = parseAgentMention(text)
    if (!agentName) return

    setLoading(true)
    setStreamingContent('')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const body: AgentInvokeRequest = {
        docId: docId as DocId,
        prompt: text,
        agentName,
        provider,
        model,
        apiKey,
        ...(provider === 'litellm' && baseUrl ? { baseUrl } : {}),
      }

      const res = await fetch(`${SERVER_URL}/agent/invoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

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
            if (chunk.type === 'token') {
              setStreamingContent(prev => (prev ?? '') + chunk.content)
            }
          } catch {
            void 0
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        const msg = err instanceof Error ? err.message : String(err)
        setStreamingContent(`⚠️ ${msg}`)
      }
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }, [prompt, loading, docId, provider, model, apiKey, baseUrl, token, authorName, appendMessage])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const messages = history ?? []

  return (
    <div className="flex flex-col h-full bg-[#f9fafb]" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <details className="px-6 py-3 border-b border-[#e7ecf1] group bg-white">
        <summary className="text-xs font-semibold text-[#8fa0b1] cursor-pointer outline-none list-none flex items-center gap-1 hover:text-[#1a1c1d] transition-colors">
          <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          Configure AI
        </summary>
        <div className="pt-3 space-y-2">
          <div className="flex gap-2">
            <select
              value={provider}
              onChange={e => handleProviderChange(e.target.value as Provider)}
              className="flex-1 text-xs bg-white border border-[#e7ecf1] rounded-md px-2 py-1.5 text-[#1a1c1d] focus:outline-none focus:border-[#8fa0b1]"
            >
              {PROVIDERS.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            {provider === 'litellm' ? (
              <input
                type="text"
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="Model name"
                className="flex-1 text-xs bg-white border border-[#e7ecf1] rounded-md px-2 py-1.5 text-[#1a1c1d] placeholder-[#8fa0b1] focus:outline-none focus:border-[#8fa0b1]"
              />
            ) : (
              <select
                value={model}
                onChange={e => setModel(e.target.value)}
                className="flex-1 text-xs bg-white border border-[#e7ecf1] rounded-md px-2 py-1.5 text-[#1a1c1d] focus:outline-none focus:border-[#8fa0b1]"
              >
                {MODELS[provider].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            )}
          </div>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="API Key"
            className="w-full text-xs bg-white border border-[#e7ecf1] rounded-md px-2 py-1.5 text-[#1a1c1d] placeholder-[#8fa0b1] focus:outline-none focus:border-[#8fa0b1]"
          />
          {provider === 'litellm' && (
            <input
              type="text"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder="Base URL (e.g. http://localhost:4000/v1)"
              className="w-full text-xs bg-white border border-[#e7ecf1] rounded-md px-2 py-1.5 text-[#1a1c1d] placeholder-[#8fa0b1] focus:outline-none focus:border-[#8fa0b1]"
            />
          )}
          <p className="text-[11px] text-[#8fa0b1]">Mention <code className="bg-[#f0f2f4] px-1 rounded">@jot</code> or <code className="bg-[#f0f2f4] px-1 rounded">@verse</code> to invoke an agent.</p>
        </div>
      </details>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {messages.length === 0 && !streamingContent && (
          <p className="text-[13px] text-[#8fa0b1] text-center pt-8">
            Type <code className="bg-[#f0f2f4] px-1 rounded text-[12px]">@jot</code> or <code className="bg-[#f0f2f4] px-1 rounded text-[12px]">@verse</code> to invoke an agent.
          </p>
        )}
        {messages.map((msg: AgentMessage) => (
          <div key={msg._id} className="flex gap-3">
            {msg.role === 'user' ? (
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
                  {msg.role === 'user' ? (msg.authorName ?? 'You') : (msg.authorName ?? 'Jot')}
                </span>
              </div>
              <div className={`text-[15px] leading-snug whitespace-pre-wrap break-words ${
                msg.role === 'user'
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
                <span className="text-[14px] font-semibold text-[#1a1c1d]">Jot</span>
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
          placeholder="Type a message, or @jot / @verse to invoke an agent..."
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
