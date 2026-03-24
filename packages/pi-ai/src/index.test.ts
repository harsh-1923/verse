import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { StreamSimpleOptions } from './index.js'

const mockTextStream = vi.fn()
const mockStreamText = vi.fn()

vi.mock('ai', () => ({
  streamText: mockStreamText,
}))

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: () => (model: string) => ({ provider: 'openai', model }),
}))

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: () => (model: string) => ({ provider: 'anthropic', model }),
}))

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: () => (model: string) => ({ provider: 'google', model }),
}))

vi.mock('@ai-sdk/groq', () => ({
  createGroq: () => (model: string) => ({ provider: 'groq', model }),
}))

async function* makeStream(chunks: string[]) {
  for (const chunk of chunks) {
    yield chunk
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockTextStream.mockReturnValue(makeStream(['hello', ' world']))
  mockStreamText.mockReturnValue({ textStream: makeStream(['hello', ' world']) })
})

describe('streamSimple', () => {
  const baseOpts: StreamSimpleOptions = {
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: 'test-key',
    messages: [{ role: 'user', content: 'hi' }],
  }

  it('yields tokens from openai', async () => {
    const { streamSimple } = await import('./index.js')
    const tokens: string[] = []
    for await (const token of streamSimple(baseOpts)) {
      tokens.push(token)
    }
    expect(tokens).toEqual(['hello', ' world'])
    expect(mockStreamText).toHaveBeenCalledOnce()
  })

  it('yields tokens from anthropic', async () => {
    const { streamSimple } = await import('./index.js')
    const tokens: string[] = []
    for await (const token of streamSimple({ ...baseOpts, provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' })) {
      tokens.push(token)
    }
    expect(tokens).toEqual(['hello', ' world'])
  })

  it('yields tokens from google', async () => {
    const { streamSimple } = await import('./index.js')
    const tokens: string[] = []
    for await (const token of streamSimple({ ...baseOpts, provider: 'google', model: 'gemini-1.5-pro' })) {
      tokens.push(token)
    }
    expect(tokens).toEqual(['hello', ' world'])
  })

  it('yields tokens from groq', async () => {
    const { streamSimple } = await import('./index.js')
    const tokens: string[] = []
    for await (const token of streamSimple({ ...baseOpts, provider: 'groq', model: 'llama-3.1-70b-versatile' })) {
      tokens.push(token)
    }
    expect(tokens).toEqual(['hello', ' world'])
  })

  it('passes system prompt to streamText', async () => {
    const { streamSimple } = await import('./index.js')
    const gen = streamSimple({ ...baseOpts, system: 'Be helpful' })
    await gen.next()
    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({ system: 'Be helpful' }),
    )
  })

  it('concatenates all tokens into full response', async () => {
    const { streamSimple } = await import('./index.js')
    let full = ''
    for await (const token of streamSimple(baseOpts)) {
      full += token
    }
    expect(full).toBe('hello world')
  })
})
