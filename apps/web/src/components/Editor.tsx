import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import { Markdown } from '@tiptap/markdown'
import { HocuspocusProvider } from '@hocuspocus/provider'
import * as Y from 'yjs'
import { useEffect, useRef, useState } from 'react'

interface EditorProps {
  documentId: string
  userName?: string
  userColor?: string
  token?: string
}

const SERVER_WS = import.meta.env.VITE_SERVER_WS ?? 'ws://localhost:3000'

const btn = (active: boolean, extra = '') =>
  `h-7 flex items-center justify-center rounded px-2 text-[13px] transition-colors ${extra} ${
    active
      ? 'bg-[#ffddd4] text-[#f98047]'
      : 'text-[#585d62] hover:bg-[#f9fafb] hover:text-[#1a1c1d]'
  }`

const sep = <div className="w-px h-4 bg-[#e7ecf1] mx-0.5 shrink-0" />

export function CollaborativeEditor({ documentId, token }: EditorProps) {
  const ydocRef = useRef(new Y.Doc())
  const fragmentRef = useRef(ydocRef.current.getXmlFragment('default'))
  const providerRef = useRef<HocuspocusProvider | null>(null)
  const [connected, setConnected] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ fragment: fragmentRef.current }),
      Markdown,
    ],
    editable: true,
    autofocus: true,
  })

  useEffect(() => {
    if (!token || providerRef.current) return
    const provider = new HocuspocusProvider({
      url: SERVER_WS,
      name: documentId,
      document: ydocRef.current,
      token,
      onConnect: () => setConnected(true),
      onDisconnect: () => setConnected(false),
    })
    providerRef.current = provider
    return () => { provider.destroy(); providerRef.current = null }
  }, [documentId, token])

  void connected

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {editor && (
        <>
          <BubbleMenu
            editor={editor}
            className="flex items-center gap-0.5 bg-white border border-[#e7ecf1] rounded-lg shadow-lg px-1.5 py-1 z-50"
          >
            <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run() }} className={btn(editor.isActive('bold'), 'font-bold w-7')}>B</button>
            <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run() }} className={btn(editor.isActive('italic'), 'italic w-7')}>I</button>
            <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleUnderline().run() }} className={btn(editor.isActive('underline'), 'underline w-7')}>U</button>
            <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleStrike().run() }} className={btn(editor.isActive('strike'), 'line-through w-7')}>S</button>
            <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleCode().run() }} className={btn(editor.isActive('code'), 'font-mono w-7')}>`</button>
            {sep}
            <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 1 }).run() }} className={btn(editor.isActive('heading', { level: 1 }), 'font-semibold text-[11px]')}>H1</button>
            <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run() }} className={btn(editor.isActive('heading', { level: 2 }), 'font-semibold text-[11px]')}>H2</button>
            <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 3 }).run() }} className={btn(editor.isActive('heading', { level: 3 }), 'font-semibold text-[11px]')}>H3</button>
            {sep}
            <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBulletList().run() }} className={btn(editor.isActive('bulletList'), 'w-7')}>•</button>
            <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run() }} className={btn(editor.isActive('orderedList'), 'text-[11px]')}>1.</button>
            <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBlockquote().run() }} className={btn(editor.isActive('blockquote'), 'w-7 text-base')}>"</button>
            <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleCodeBlock().run() }} className={btn(editor.isActive('codeBlock'), 'font-mono text-[11px]')}>{'{}'}</button>
          </BubbleMenu>

          <FloatingMenu
            editor={editor}
            className="flex items-center gap-0.5 bg-white border border-[#e7ecf1] rounded-lg shadow-md px-1.5 py-1 z-50"
          >
            <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 1 }).run() }} className={btn(editor.isActive('heading', { level: 1 }), 'font-semibold text-[11px]')}>H1</button>
            <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run() }} className={btn(editor.isActive('heading', { level: 2 }), 'font-semibold text-[11px]')}>H2</button>
            <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 3 }).run() }} className={btn(editor.isActive('heading', { level: 3 }), 'font-semibold text-[11px]')}>H3</button>
            {sep}
            <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBulletList().run() }} className={btn(editor.isActive('bulletList'), 'w-7')}>•</button>
            <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run() }} className={btn(editor.isActive('orderedList'), 'text-[11px]')}>1.</button>
            <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBlockquote().run() }} className={btn(editor.isActive('blockquote'), 'w-7 text-base')}>"</button>
            <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleCodeBlock().run() }} className={btn(editor.isActive('codeBlock'), 'font-mono text-[11px]')}>{'{}'}</button>
            <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().setHorizontalRule().run() }} className={btn(false, 'text-[11px]')}>—</button>
          </FloatingMenu>
        </>
      )}
      <EditorContent
        editor={editor}
        className="prose prose-stone max-w-none focus:outline-none [&_.tiptap]:outline-none [&_.tiptap]:min-h-[400px] [&_.tiptap]:cursor-text text-[16px] text-[#1a1c1d]"
      />
    </div>
  )
}
