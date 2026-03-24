import { useState, useCallback } from 'react'
import { Authenticated, Unauthenticated, AuthLoading, useQuery, useMutation } from 'convex/react'
import { useAuthActions } from '@convex-dev/auth/react'
import { useAuthToken } from '@convex-dev/auth/react'
import { anyApi } from 'convex/server'
import { CollaborativeEditor } from './components/Editor'
import { AgentPanel } from './components/AgentPanel'
import { DocumentList } from './components/DocumentList'
import { SignInPage } from './components/SignInPage'

interface Doc {
  _id: string
  title: string
}

function EditorView({ docId, onBack, token, authorName }: { docId: string; onBack: () => void; token?: string; authorName?: string }) {
  const [agentOpen, setAgentOpen] = useState(true)
  const doc = useQuery(anyApi.documents.getDocument, { docId }) as Doc | null | undefined
  const updateDocument = useMutation(anyApi.documents.updateDocument)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const { signOut } = useAuthActions()

  const startEditTitle = useCallback(() => {
    setTitleDraft(doc?.title ?? '')
    setEditingTitle(true)
  }, [doc?.title])

  const commitTitle = useCallback(async () => {
    const trimmed = titleDraft.trim()
    if (trimmed && trimmed !== doc?.title) {
      await updateDocument({ docId, title: trimmed })
    }
    setEditingTitle(false)
  }, [titleDraft, doc?.title, docId, updateDocument])

  return (
    <div className="flex h-screen bg-white overflow-hidden" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center justify-between px-6 h-12 border-b border-[#e7ecf1] bg-white shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-xs text-[#8fa0b1] hover:text-[#1a1c1d] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              All documents
            </button>
            <div className="w-px h-4 bg-[#e7ecf1]" />
            <span className="text-sm font-medium text-[#1a1c1d]">Verse</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                const url = `${window.location.origin}${window.location.pathname}?doc=${docId}`
                void navigator.clipboard.writeText(url)
              }}
              className="text-xs text-[#a3abaf] hover:text-[#1a1c1d] transition-colors"
            >
              Share
            </button>
            <button
              onClick={() => setAgentOpen(o => !o)}
              className="text-xs text-[#a3abaf] hover:text-[#1a1c1d] transition-colors"
            >
              {agentOpen ? 'Hide Agent' : 'Show Agent'}
            </button>
            <button
              onClick={() => void signOut()}
              className="text-xs text-[#a3abaf] hover:text-[#1a1c1d] transition-colors"
            >
              Sign out
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-16 py-10 w-full mx-auto max-w-[640px]">
          <div className="mb-6">
            {editingTitle ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onBlur={() => void commitTitle()}
                onKeyDown={e => { if (e.key === 'Enter') void commitTitle() }}
                className="text-[28px] font-semibold text-[#1a1c1d] tracking-tight leading-tight w-full bg-transparent border-none outline-none focus:outline-none"
              />
            ) : (
              <h1
                onClick={startEditTitle}
                className="text-[28px] font-semibold text-[#1a1c1d] tracking-tight leading-tight cursor-text hover:opacity-70 transition-opacity"
              >
                {doc?.title ?? '…'}
              </h1>
            )}
          </div>
          <CollaborativeEditor documentId={docId} token={token} />
        </div>
      </main>

      {agentOpen && (
        <aside className="w-[540px] shrink-0 border-l border-[#e7ecf1] bg-[#f9fafb] flex flex-col h-full overflow-hidden">
          <AgentPanel docId={docId} token={token} authorName={authorName} />
        </aside>
      )}
    </div>
  )
}

function AuthenticatedApp() {
  const [docId, setDocId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('doc')
  })
  const token = useAuthToken()
  const { signOut } = useAuthActions()
  const viewer = useQuery(anyApi.documents.viewer) as { name: string } | null | undefined

  const openDoc = useCallback((id: string | null) => {
    setDocId(id)
    const url = new URL(window.location.href)
    if (id) url.searchParams.set('doc', id)
    else url.searchParams.delete('doc')
    window.history.replaceState(null, '', url.toString())
  }, [])

  if (!docId) {
    return (
      <div className="relative">
        <div className="absolute top-3.5 right-8 flex items-center gap-4 z-10">
          <button
            onClick={() => void signOut()}
            className="text-xs text-[#a3abaf] hover:text-[#1a1c1d] transition-colors"
          >
            Sign out
          </button>
        </div>
        <DocumentList onOpen={openDoc} />
      </div>
    )
  }

  return (
    <EditorView
      docId={docId}
      onBack={() => openDoc(null)}
      token={token ?? undefined}
      authorName={viewer?.name}
    />
  )
}

function App() {
  return (
    <>
      <AuthLoading>
        <div className="flex h-screen items-center justify-center bg-white">
          <div className="w-5 h-5 rounded-full border-2 border-[#e7ecf1] border-t-[#8fa0b1] animate-spin" />
        </div>
      </AuthLoading>
      <Unauthenticated>
        <SignInPage />
      </Unauthenticated>
      <Authenticated>
        <AuthenticatedApp />
      </Authenticated>
    </>
  )
}

export default App
