import { useState, useCallback } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { anyApi } from 'convex/server'

interface Doc {
  _id: string
  title: string
  updatedAt: number
}

interface DocumentListProps {
  onOpen: (docId: string) => void
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function DocumentList({ onOpen }: DocumentListProps) {
  const docs = useQuery(anyApi.documents.listDocuments) as Doc[] | undefined
  const createDocument = useMutation(anyApi.documents.createDocument)
  const deleteDocument = useMutation(anyApi.documents.deleteDocument)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleCreate = useCallback(async () => {
    setCreating(true)
    try {
      const docId = await createDocument({ title: 'Untitled' })
      onOpen(docId as string)
    } finally {
      setCreating(false)
    }
  }, [createDocument, onOpen])

  const handleDelete = useCallback(async (e: React.MouseEvent, docId: string) => {
    e.stopPropagation()
    setDeletingId(docId)
    try {
      await deleteDocument({ docId })
    } finally {
      setDeletingId(null)
    }
  }, [deleteDocument])

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <header className="flex items-center justify-between px-8 h-14 border-b border-[#e7ecf1]">
        <span className="text-sm font-semibold text-[#1a1c1d]">Verse</span>
        <button
          onClick={() => void handleCreate()}
          disabled={creating}
          className="flex items-center gap-1.5 bg-[#1a1c1d] hover:bg-[#2d3033] text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New document
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-8 py-10">
        <h1 className="text-[22px] font-semibold text-[#1a1c1d] mb-6">Documents</h1>

        {docs === undefined && (
          <div className="flex justify-center pt-16">
            <div className="w-5 h-5 rounded-full border-2 border-[#e7ecf1] border-t-[#8fa0b1] animate-spin" />
          </div>
        )}

        {docs?.length === 0 && (
          <div className="text-center pt-16">
            <p className="text-[14px] text-[#8fa0b1] mb-4">No documents yet.</p>
            <button
              onClick={() => void handleCreate()}
              disabled={creating}
              className="text-[13px] text-[#f98047] hover:underline disabled:opacity-50"
            >
              Create your first document
            </button>
          </div>
        )}

        {docs && docs.length > 0 && (
          <ul className="divide-y divide-[#f0f2f4]">
            {docs.map((doc) => (
              <li
                key={doc._id}
                onClick={() => onOpen(doc._id)}
                className="flex items-center justify-between py-3.5 cursor-pointer group hover:bg-[#fafafa] -mx-3 px-3 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <svg className="w-4 h-4 text-[#c2ccd6] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <span className="text-[14px] font-medium text-[#1a1c1d] truncate">{doc.title}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className="text-[12px] text-[#a3abaf]">{timeAgo(doc.updatedAt)}</span>
                  <button
                    onClick={(e) => void handleDelete(e, doc._id)}
                    disabled={deletingId === doc._id}
                    className="opacity-0 group-hover:opacity-100 p-1 text-[#c2ccd6] hover:text-red-400 transition-all rounded disabled:opacity-30"
                    title="Delete"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
