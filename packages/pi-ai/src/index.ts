import { streamText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'
import type { LanguageModel } from 'ai'

export type Provider = 'openai' | 'anthropic' | 'google' | 'groq' | 'litellm'

export interface StreamSimpleOptions {
  provider: Provider
  model: string
  apiKey: string
  baseUrl?: string
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[]
  system?: string
}

function resolveModel(provider: Provider, model: string, apiKey: string, baseUrl?: string): LanguageModel {
  switch (provider) {
    case 'openai':
      return createOpenAI({ apiKey })(model)
    case 'anthropic':
      return createAnthropic({ apiKey })(model)
    case 'google':
      return createGoogleGenerativeAI({ apiKey })(model)
    case 'groq':
      return createGroq({ apiKey })(model)
    case 'litellm':
      return createOpenAI({ apiKey, baseURL: baseUrl ?? 'http://localhost:4000/v1' })(model)
    default: {
      const _exhaustive: never = provider
      throw new Error(`Unknown provider: ${String(_exhaustive)}`)
    }
  }
}

export async function* streamSimple(opts: StreamSimpleOptions): AsyncGenerator<string> {
  const { provider, model, apiKey, baseUrl, messages, system } = opts
  const languageModel = resolveModel(provider, model, apiKey, baseUrl)
  const result = streamText({ model: languageModel, messages, system })
  for await (const chunk of result.textStream) {
    yield chunk
  }
}
