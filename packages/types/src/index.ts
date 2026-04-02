export type DocId = string & { readonly __brand: 'DocId' }
export type UserId = string & { readonly __brand: 'UserId' }
export type AgentId = string & { readonly __brand: 'AgentId' }

export type Provider = 'openai' | 'anthropic' | 'google' | 'groq' | 'litellm'

export interface AgentInvokeRequest {
  docId: DocId
  prompt: string
  agentId: string
}

export interface AgentInvokeChunk {
  type: 'token' | 'done' | 'error'
  content: string
}

export interface ExportRequest {
  docId: DocId
}

export interface ImportRequest {
  docId: DocId
  content: string
}

export interface ConvexDocument {
  _id: string
  title: string
  ownerId: UserId
  createdAt: number
  updatedAt: number
}

export interface YjsSnapshot {
  docId: DocId
  update: string
  savedAt: number
}

export interface Agent {
  _id: string
  name: string
  tag: string
  description: string
  avatarUrl?: string
  systemPrompt: string
  toolIds: string[]
  provider: Provider
  model: string
  builtIn: boolean
  createdBy?: string
  createdAt: number
  updatedAt: number
}

export interface AgentKey {
  _id: string
  agentId: string
  encryptedKey: string
  createdAt: number
  updatedAt: number
}

export interface Message {
  _id: string
  docId: DocId
  content: string
  authorId: string
  authorType: 'user' | 'agent'
  timestamp: number
}

export interface DocumentParticipant {
  _id: string
  docId: DocId
  participantId: string
  participantType: 'user' | 'agent'
  joinedAt: number
}

export { TOOL_REGISTRY, ALL_TOOL_IDS } from './tools.js'
export type { ToolRegistryEntry, ToolId } from './tools.js'
