import { BubbleMenu as TiptapBubbleMenu } from '@tiptap/react/menus'
import type { Editor } from '@tiptap/react'

interface EditorBubbleMenuProps {
  editor: Editor
}

const btn = (active: boolean, extra = '') =>
  `rounded px-2 py-1 text-sm ${extra} ${active ? 'bg-[#f0f0f0] text-black' : 'text-[#6b6b6b] hover:bg-[#f7f7f7]'}`

const sep = <div className="mx-0.5 h-4 w-px bg-[#e2e2e2]" />

export const EditorBubbleMenu = ({ editor }: EditorBubbleMenuProps) => {
  const action = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault()
    fn()
  }

  return (
    <TiptapBubbleMenu
      editor={editor}
      className="flex items-center gap-0.5 rounded-lg border border-[#e2e2e2] bg-white px-1 py-1 shadow-md"
    >
      <button onMouseDown={action(() => editor.chain().focus().toggleBold().run())} className={btn(editor.isActive('bold'), 'font-bold')}>B</button>
      <button onMouseDown={action(() => editor.chain().focus().toggleItalic().run())} className={btn(editor.isActive('italic'), 'italic')}>I</button>
      <button onMouseDown={action(() => editor.chain().focus().toggleUnderline().run())} className={btn(editor.isActive('underline'), 'underline')}>U</button>
      <button onMouseDown={action(() => editor.chain().focus().toggleStrike().run())} className={btn(editor.isActive('strike'), 'line-through')}>S</button>
      <button onMouseDown={action(() => editor.chain().focus().toggleCode().run())} className={btn(editor.isActive('code'), 'font-mono')}>{'<>'}</button>
      {sep}
      <button onMouseDown={action(() => editor.chain().focus().toggleHeading({ level: 1 }).run())} className={btn(editor.isActive('heading', { level: 1 }), 'text-xs font-semibold')}>H1</button>
      <button onMouseDown={action(() => editor.chain().focus().toggleHeading({ level: 2 }).run())} className={btn(editor.isActive('heading', { level: 2 }), 'text-xs font-semibold')}>H2</button>
      <button onMouseDown={action(() => editor.chain().focus().toggleHeading({ level: 3 }).run())} className={btn(editor.isActive('heading', { level: 3 }), 'text-xs font-semibold')}>H3</button>
      {sep}
      <button onMouseDown={action(() => editor.chain().focus().toggleBulletList().run())} className={btn(editor.isActive('bulletList'))}>&bull;</button>
      <button onMouseDown={action(() => editor.chain().focus().toggleOrderedList().run())} className={btn(editor.isActive('orderedList'), 'text-xs')}>1.</button>
      <button onMouseDown={action(() => editor.chain().focus().toggleBlockquote().run())} className={btn(editor.isActive('blockquote'))}>&ldquo;</button>
      <button onMouseDown={action(() => editor.chain().focus().toggleCodeBlock().run())} className={btn(editor.isActive('codeBlock'), 'text-xs font-mono')}>{'{}'}
      </button>
      {sep}
      <button onMouseDown={(e) => e.preventDefault()} className={btn(false)}>Write with AI</button>
    </TiptapBubbleMenu>
  )
}
