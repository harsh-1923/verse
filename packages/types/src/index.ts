export type DocId = string & { readonly __brand: 'DocId' }
export type UserId = string & { readonly __brand: 'UserId' }

export interface AgentInvokeRequest {
  docId: DocId
  prompt: string
  agentName?: string
  provider: string
  model: string
  apiKey: string
  baseUrl?: string
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

export interface AgentMessage {
  docId: DocId
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}
