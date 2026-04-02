import { useState, useCallback, useEffect } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { Field } from '@base-ui/react/field'
import { Select } from '@base-ui/react/select'
import { Checkbox } from '@base-ui/react/checkbox'
import { useMutation } from 'convex/react'
import { anyApi } from 'convex/server'
import { TOOL_REGISTRY } from '@verse/types'
import type { ToolId } from '@verse/types'
import { Check, ChevronDown } from 'lucide-react'

const PROVIDERS = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'Google', value: 'google' },
  { label: 'Groq', value: 'groq' },
  { label: 'LiteLLM', value: 'litellm' },
] as const

const MODELS: Record<string, { label: string; value: string }[]> = {
  openai: [
    { label: 'GPT-4o', value: 'gpt-4o' },
    { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
    { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
  ],
  anthropic: [
    { label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4-6' },
    { label: 'Claude Opus 4.6', value: 'claude-opus-4-6' },
    { label: 'Claude Haiku 3.5', value: 'claude-haiku-3-5' },
  ],
  google: [
    { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
    { label: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro' },
  ],
  groq: [
    { label: 'Llama 3.3 70B', value: 'llama-3.3-70b-versatile' },
    { label: 'Llama 3.1 8B', value: 'llama-3.1-8b-instant' },
  ],
  litellm: [],
}

const TOOLS = Object.entries(TOOL_REGISTRY).map(([key, entry]) => ({
  ...entry,
  id: key as ToolId,
}))

export interface AgentData {
  _id: string
  name: string
  tag: string
  description: string
  systemPrompt: string
  toolIds: string[]
  provider: string
  model: string
  builtIn: boolean
}

interface AgentDialogProps {
  agent?: AgentData
  children: React.ReactNode
}

export const AgentDialog = ({ agent, children }: AgentDialogProps) => {
  const isEdit = !!agent
  const isBuiltIn = agent?.builtIn ?? false

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [tag, setTag] = useState('')
  const [description, setDescription] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [provider, setProvider] = useState<string>('anthropic')
  const [model, setModel] = useState('claude-sonnet-4-6')
  const [apiKey, setApiKey] = useState('')
  const [selectedTools, setSelectedTools] = useState<Set<string>>(
    new Set(Object.keys(TOOL_REGISTRY)),
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createAgent = useMutation(anyApi.agents.createAgent)
  const updateAgent = useMutation(anyApi.agents.updateAgent)
  const upsertAgentKey = useMutation(anyApi.agents.upsertAgentKey)
  const deleteAgent = useMutation(anyApi.agents.deleteAgent)

  // Populate form when opening in edit mode
  useEffect(() => {
    if (open && agent) {
      setName(agent.name)
      setTag(agent.tag)
      setDescription(agent.description)
      setSystemPrompt(agent.systemPrompt)
      setProvider(agent.provider)
      setModel(agent.model)
      setSelectedTools(new Set(agent.toolIds))
      setApiKey('')
      setError(null)
    } else if (open && !agent) {
      setName('')
      setTag('')
      setDescription('')
      setSystemPrompt('')
      setProvider('anthropic')
      setModel('claude-sonnet-4-6')
      setApiKey('')
      setSelectedTools(new Set(Object.keys(TOOL_REGISTRY)))
      setError(null)
    }
  }, [open, agent])

  const handleNameChange = useCallback((value: string) => {
    setName(value)
    if (!isEdit) {
      setTag(value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''))
    }
  }, [isEdit])

  const handleProviderChange = useCallback((value: string | null) => {
    if (!value) return
    setProvider(value)
    const models = MODELS[value]
    setModel(models?.[0]?.value ?? '')
  }, [])

  const toggleTool = useCallback((toolId: string) => {
    setSelectedTools((prev) => {
      const next = new Set(prev)
      if (next.has(toolId)) {
        next.delete(toolId)
      } else {
        next.add(toolId)
      }
      return next
    })
  }, [])

  const handleDelete = useCallback(async () => {
    if (!agent || isBuiltIn) return
    setSubmitting(true)
    setError(null)
    try {
      await deleteAgent({ agentId: agent._id })
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete agent')
    } finally {
      setSubmitting(false)
    }
  }, [agent, isBuiltIn, deleteAgent])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !tag.trim() || !systemPrompt.trim()) return

    setSubmitting(true)
    setError(null)

    try {
      if (isEdit && agent) {
        await updateAgent({
          agentId: agent._id,
          name: name.trim(),
          tag: tag.trim(),
          description: description.trim(),
          systemPrompt: systemPrompt.trim(),
          toolIds: Array.from(selectedTools),
          provider: provider as 'openai' | 'anthropic' | 'google' | 'groq' | 'litellm',
          model,
        })

        if (apiKey.trim()) {
          await upsertAgentKey({
            agentId: agent._id,
            encryptedKey: apiKey.trim(),
          })
        }
      } else {
        const agentId = await createAgent({
          name: name.trim(),
          tag: tag.trim(),
          description: description.trim(),
          systemPrompt: systemPrompt.trim(),
          toolIds: Array.from(selectedTools),
          provider: provider as 'openai' | 'anthropic' | 'google' | 'groq' | 'litellm',
          model,
        })

        if (apiKey.trim()) {
          await upsertAgentKey({
            agentId,
            encryptedKey: apiKey.trim(),
          })
        }
      }

      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEdit ? 'update' : 'create'} agent`)
    } finally {
      setSubmitting(false)
    }
  }, [name, tag, description, systemPrompt, selectedTools, provider, model, apiKey, isEdit, agent, createAgent, updateAgent, upsertAgentKey])

  const modelOptions = MODELS[provider] ?? []

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger render={children as React.ReactElement} />

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/20 transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] rounded-xl bg-white shadow-xl border border-[#e7ecf1] transition-all duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 flex flex-col">
          <div className="px-6 pt-5 pb-4 border-b border-[#e7ecf1]">
            <Dialog.Title className="text-lg font-semibold text-[#1a1c1d]">
              {isEdit ? 'Edit Agent' : 'Create Agent'}
            </Dialog.Title>
            <Dialog.Description className="text-sm text-[#6b7785] mt-1">
              {isEdit
                ? isBuiltIn
                  ? 'This is a built-in agent. You can view its configuration but cannot modify it.'
                  : 'Update your agent configuration.'
                : 'Configure an AI agent that can participate in your documents.'}
            </Dialog.Description>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            <fieldset disabled={isBuiltIn} className="contents">
              <div className="px-6 py-5 space-y-5">
                {/* Name & Tag */}
                <div className="grid grid-cols-2 gap-4">
                  <Field.Root name="name" className="flex flex-col gap-1.5">
                    <Field.Label className="text-sm font-medium text-[#1a1c1d]">
                      Name
                    </Field.Label>
                    <Field.Control
                      required
                      placeholder="My Assistant"
                      value={name}
                      onChange={(e) => handleNameChange((e.target as HTMLInputElement).value)}
                      className="h-9 rounded-lg border border-[#e2e2e2] bg-white px-3 text-sm text-[#1a1c1d] placeholder:text-[#8fa0b1] focus:outline-none focus:border-[#6b7785] transition-colors disabled:bg-[#f7f7f7] disabled:text-[#8fa0b1]"
                    />
                  </Field.Root>

                  <Field.Root name="tag" className="flex flex-col gap-1.5">
                    <Field.Label className="text-sm font-medium text-[#1a1c1d]">
                      Tag
                    </Field.Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8fa0b1]">@</span>
                      <Field.Control
                        required
                        placeholder="my-assistant"
                        value={tag}
                        onChange={(e) => setTag((e.target as HTMLInputElement).value)}
                        className="h-9 w-full rounded-lg border border-[#e2e2e2] bg-white pl-7 pr-3 text-sm text-[#1a1c1d] placeholder:text-[#8fa0b1] focus:outline-none focus:border-[#6b7785] transition-colors disabled:bg-[#f7f7f7] disabled:text-[#8fa0b1]"
                      />
                    </div>
                  </Field.Root>
                </div>

                {/* Description */}
                <Field.Root name="description" className="flex flex-col gap-1.5">
                  <Field.Label className="text-sm font-medium text-[#1a1c1d]">
                    Description
                  </Field.Label>
                  <Field.Control
                    placeholder="A helpful assistant for..."
                    value={description}
                    onChange={(e) => setDescription((e.target as HTMLInputElement).value)}
                    className="h-9 rounded-lg border border-[#e2e2e2] bg-white px-3 text-sm text-[#1a1c1d] placeholder:text-[#8fa0b1] focus:outline-none focus:border-[#6b7785] transition-colors disabled:bg-[#f7f7f7] disabled:text-[#8fa0b1]"
                  />
                </Field.Root>

                {/* System Prompt */}
                <Field.Root name="systemPrompt" className="flex flex-col gap-1.5">
                  <Field.Label className="text-sm font-medium text-[#1a1c1d]">
                    System Prompt
                  </Field.Label>
                  <textarea
                    required
                    placeholder="You are a helpful assistant that..."
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={3}
                    className="rounded-lg border border-[#e2e2e2] bg-white px-3 py-2 text-sm text-[#1a1c1d] placeholder:text-[#8fa0b1] focus:outline-none focus:border-[#6b7785] transition-colors resize-none disabled:bg-[#f7f7f7] disabled:text-[#8fa0b1]"
                  />
                </Field.Root>

                {/* Provider & Model */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-[#1a1c1d]">Provider</label>
                    <Select.Root value={provider} onValueChange={handleProviderChange} disabled={isBuiltIn}>
                      <Select.Trigger className="flex h-9 items-center justify-between rounded-lg border border-[#e2e2e2] bg-white px-3 text-sm text-[#1a1c1d] focus:outline-none focus:border-[#6b7785] transition-colors data-[popup-open]:border-[#6b7785] data-[disabled]:bg-[#f7f7f7] data-[disabled]:text-[#8fa0b1]">
                        <Select.Value />
                        <Select.Icon className="text-[#8fa0b1]">
                          <ChevronDown size={14} />
                        </Select.Icon>
                      </Select.Trigger>
                      <Select.Portal>
                        <Select.Positioner sideOffset={4}>
                          <Select.Popup className="rounded-lg bg-white shadow-lg border border-[#e7ecf1] py-1 z-50 origin-[var(--transform-origin)] transition-all duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
                            <Select.List>
                              {PROVIDERS.map((p) => (
                                <Select.Item
                                  key={p.value}
                                  value={p.value}
                                  className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-default outline-none data-[highlighted]:bg-[#f0f2f4] text-[#1a1c1d]"
                                >
                                  <Select.ItemIndicator className="text-[#f98047]">
                                    <Check size={14} />
                                  </Select.ItemIndicator>
                                  <Select.ItemText>{p.label}</Select.ItemText>
                                </Select.Item>
                              ))}
                            </Select.List>
                          </Select.Popup>
                        </Select.Positioner>
                      </Select.Portal>
                    </Select.Root>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-[#1a1c1d]">Model</label>
                    {modelOptions.length > 0 ? (
                      <Select.Root value={model} onValueChange={(v) => v && setModel(v)} disabled={isBuiltIn}>
                        <Select.Trigger className="flex h-9 items-center justify-between rounded-lg border border-[#e2e2e2] bg-white px-3 text-sm text-[#1a1c1d] focus:outline-none focus:border-[#6b7785] transition-colors data-[popup-open]:border-[#6b7785] data-[disabled]:bg-[#f7f7f7] data-[disabled]:text-[#8fa0b1]">
                          <Select.Value />
                          <Select.Icon className="text-[#8fa0b1]">
                            <ChevronDown size={14} />
                          </Select.Icon>
                        </Select.Trigger>
                        <Select.Portal>
                          <Select.Positioner sideOffset={4}>
                            <Select.Popup className="rounded-lg bg-white shadow-lg border border-[#e7ecf1] py-1 z-50 origin-[var(--transform-origin)] transition-all duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
                              <Select.List>
                                {modelOptions.map((m) => (
                                  <Select.Item
                                    key={m.value}
                                    value={m.value}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-default outline-none data-[highlighted]:bg-[#f0f2f4] text-[#1a1c1d]"
                                  >
                                    <Select.ItemIndicator className="text-[#f98047]">
                                      <Check size={14} />
                                    </Select.ItemIndicator>
                                    <Select.ItemText>{m.label}</Select.ItemText>
                                  </Select.Item>
                                ))}
                              </Select.List>
                            </Select.Popup>
                          </Select.Positioner>
                        </Select.Portal>
                      </Select.Root>
                    ) : (
                      <input
                        type="text"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        placeholder="Model name"
                        className="h-9 rounded-lg border border-[#e2e2e2] bg-white px-3 text-sm text-[#1a1c1d] placeholder:text-[#8fa0b1] focus:outline-none focus:border-[#6b7785] transition-colors disabled:bg-[#f7f7f7] disabled:text-[#8fa0b1]"
                      />
                    )}
                  </div>
                </div>

                {/* API Key */}
                <Field.Root name="apiKey" className="flex flex-col gap-1.5">
                  <Field.Label className="text-sm font-medium text-[#1a1c1d]">
                    API Key
                  </Field.Label>
                  <Field.Control
                    type="password"
                    placeholder={isEdit ? 'Leave blank to keep current key' : 'sk-...'}
                    value={apiKey}
                    onChange={(e) => setApiKey((e.target as HTMLInputElement).value)}
                    disabled={isBuiltIn}
                    className="h-9 rounded-lg border border-[#e2e2e2] bg-white px-3 text-sm text-[#1a1c1d] placeholder:text-[#8fa0b1] focus:outline-none focus:border-[#6b7785] transition-colors disabled:bg-[#f7f7f7] disabled:text-[#8fa0b1]"
                  />
                  <Field.Description className="text-xs text-[#8fa0b1]">
                    Your API key is stored encrypted and never shared.
                  </Field.Description>
                </Field.Root>

                {/* Tools */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-[#1a1c1d]">Tools</label>
                  <div className="space-y-2">
                    {TOOLS.map((tool) => (
                      <label
                        key={tool.id}
                        className="flex items-start gap-2.5 cursor-pointer group"
                      >
                        <Checkbox.Root
                          checked={selectedTools.has(tool.id)}
                          onCheckedChange={() => toggleTool(tool.id)}
                          disabled={isBuiltIn}
                          className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border border-[#d1d5db] bg-white transition-colors data-[checked]:bg-[#f98047] data-[checked]:border-[#f98047] data-[disabled]:opacity-50"
                        >
                          <Checkbox.Indicator className="text-white data-[unchecked]:hidden">
                            <Check size={12} />
                          </Checkbox.Indicator>
                        </Checkbox.Root>
                        <div>
                          <div className="text-sm text-[#1a1c1d] group-hover:text-[#f98047] transition-colors">
                            {tool.name}
                          </div>
                          <div className="text-xs text-[#8fa0b1]">{tool.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                )}
              </div>
            </fieldset>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[#e7ecf1] flex justify-between">
              <div>
                {isEdit && !isBuiltIn && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={submitting}
                    className="h-9 px-4 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <Dialog.Close className="h-9 px-4 rounded-lg border border-[#e2e2e2] text-sm font-medium text-[#6b7785] hover:bg-[#f7f7f7] transition-colors">
                  {isBuiltIn ? 'Close' : 'Cancel'}
                </Dialog.Close>
                {!isBuiltIn && (
                  <button
                    type="submit"
                    disabled={submitting || !name.trim() || !tag.trim() || !systemPrompt.trim()}
                    className="h-9 px-4 rounded-lg bg-[#f98047] text-sm font-medium text-white hover:bg-[#e8703a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting
                      ? isEdit ? 'Saving...' : 'Creating...'
                      : isEdit ? 'Save Changes' : 'Create Agent'}
                  </button>
                )}
              </div>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// Convenience alias for backwards compatibility
export const CreateAgentDialog = AgentDialog
