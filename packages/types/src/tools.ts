export interface ToolRegistryEntry {
  id: string
  name: string
  description: string
}

export const TOOL_REGISTRY = {
  write_to_doc: {
    id: 'write_to_doc',
    name: 'Write to Document',
    description: 'Append markdown content to the document',
  },
  read_section: {
    id: 'read_section',
    name: 'Read Section',
    description: 'Read a range of characters from the document',
  },
  replace_range: {
    id: 'replace_range',
    name: 'Replace Range',
    description: 'Replace the entire document content',
  },
} as const

export type ToolId = keyof typeof TOOL_REGISTRY
export const ALL_TOOL_IDS = Object.keys(TOOL_REGISTRY) as ToolId[]
