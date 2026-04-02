import * as Y from 'yjs'
import { z } from 'zod'
import type { ToolDefinition } from '@verse/pi-agent-core'
import type { Hocuspocus } from '@hocuspocus/server'

let hocuspocusInstance: Hocuspocus | null = null
const standaloneDocMap = new Map<string, Y.Doc>()

export function setHocuspocusServer(server: Hocuspocus): void {
  hocuspocusInstance = server
}

function getYDoc(docId: string): Y.Doc {
  if (hocuspocusInstance) {
    const doc = hocuspocusInstance.documents.get(docId)
    if (doc) return doc
  }
  let standalone = standaloneDocMap.get(docId)
  if (!standalone) {
    standalone = new Y.Doc()
    standaloneDocMap.set(docId, standalone)
  }
  return standalone
}

function getYFragment(docId: string): Y.XmlFragment {
  return getYDoc(docId).getXmlFragment('default')
}

// Apply inline marks (bold, italic, code) to a Y.XmlText node
function applyInlineMarks(text: Y.XmlText, raw: string): void {
  const segments: Array<{ text: string; attrs: Record<string, unknown> }> = []
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|([^*`]+))/g
  let match: RegExpExecArray | null
  while ((match = re.exec(raw)) !== null) {
    if (match[2]) segments.push({ text: match[2], attrs: { bold: true } })
    else if (match[3]) segments.push({ text: match[3], attrs: { italic: true } })
    else if (match[4]) segments.push({ text: match[4], attrs: { code: true } })
    else if (match[5]) segments.push({ text: match[5], attrs: {} })
  }
  if (segments.length === 0) {
    text.insert(0, raw)
    return
  }
  let offset = 0
  for (const seg of segments) {
    text.insert(offset, seg.text, Object.keys(seg.attrs).length > 0 ? seg.attrs : undefined)
    offset += seg.text.length
  }
}

function makeParagraph(raw: string): Y.XmlElement {
  const el = new Y.XmlElement('paragraph')
  const t = new Y.XmlText()
  applyInlineMarks(t, raw)
  el.insert(0, [t])
  return el
}

function makeHeading(raw: string, level: number): Y.XmlElement {
  const el = new Y.XmlElement('heading')
  el.setAttribute('level', level)
  const t = new Y.XmlText()
  applyInlineMarks(t, raw)
  el.insert(0, [t])
  return el
}

function makeCodeBlock(code: string): Y.XmlElement {
  const el = new Y.XmlElement('codeBlock')
  const t = new Y.XmlText()
  t.insert(0, code)
  el.insert(0, [t])
  return el
}

function makeHorizontalRule(): Y.XmlElement {
  return new Y.XmlElement('horizontalRule')
}

type YNode = Y.XmlElement | Y.XmlText

// Parse markdown text into a list of TipTap-compatible Y.XmlElement nodes
function markdownToYNodes(markdown: string): YNode[] {
  const lines = markdown.split('\n')
  const nodes: YNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]!

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      nodes.push(makeHeading(headingMatch[2]!, headingMatch[1]!.length))
      i++
      continue
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      nodes.push(makeHorizontalRule())
      i++
      continue
    }

    // Fenced code block
    if (line.startsWith('```')) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i]!.startsWith('```')) {
        codeLines.push(lines[i]!)
        i++
      }
      i++ // skip closing ```
      nodes.push(makeCodeBlock(codeLines.join('\n')))
      continue
    }

    // Bullet list
    if (/^[-*]\s/.test(line)) {
      const listEl = new Y.XmlElement('bulletList')
      while (i < lines.length && /^[-*]\s/.test(lines[i]!)) {
        const itemText = lines[i]!.replace(/^[-*]\s+/, '')
        const itemEl = new Y.XmlElement('listItem')
        itemEl.insert(0, [makeParagraph(itemText)])
        listEl.insert(listEl.length, [itemEl])
        i++
      }
      nodes.push(listEl)
      continue
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const listEl = new Y.XmlElement('orderedList')
      while (i < lines.length && /^\d+\.\s/.test(lines[i]!)) {
        const itemText = lines[i]!.replace(/^\d+\.\s+/, '')
        const itemEl = new Y.XmlElement('listItem')
        itemEl.insert(0, [makeParagraph(itemText)])
        listEl.insert(listEl.length, [itemEl])
        i++
      }
      nodes.push(listEl)
      continue
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const bq = new Y.XmlElement('blockquote')
      bq.insert(0, [makeParagraph(line.slice(2))])
      nodes.push(bq)
      i++
      continue
    }

    // Empty line → skip (don't insert empty paragraphs between blocks)
    if (line.trim() === '') {
      i++
      continue
    }

    // Regular paragraph
    nodes.push(makeParagraph(line))
    i++
  }

  return nodes
}

export const writeToDocTool: ToolDefinition<{ docId: string; content: string }, { ok: boolean }> = {
  name: 'write_to_doc',
  description: 'Append markdown content to the end of the document',
  inputSchema: z.object({
    docId: z.string(),
    content: z.string(),
  }),
  async execute({ docId, content }) {
    const frag = getYFragment(docId)
    const nodes = markdownToYNodes(content)
    if (nodes.length === 0) return { ok: true }
    frag.doc!.transact(() => {
      frag.insert(frag.length, nodes)
    })
    return { ok: true }
  },
}

export const readSectionTool: ToolDefinition<{ docId: string; from: number; to: number }, { text: string }> = {
  name: 'read_section',
  description: 'Read a range of characters [from, to] from the document. Use from=0, to=9999 to read everything.',
  inputSchema: z.object({
    docId: z.string(),
    from: z.number(),
    to: z.number(),
  }),
  async execute({ docId, from, to }) {
    const frag = getYFragment(docId)
    return { text: frag.toString().slice(from, to) }
  },
}

export const replaceRangeTool: ToolDefinition<
  { docId: string; content: string },
  { ok: boolean }
> = {
  name: 'replace_range',
  description: 'Replace the entire document content with new markdown content',
  inputSchema: z.object({
    docId: z.string(),
    content: z.string(),
  }),
  async execute({ docId, content }) {
    const frag = getYFragment(docId)
    const nodes = markdownToYNodes(content)
    frag.doc!.transact(() => {
      frag.delete(0, frag.length)
      if (nodes.length > 0) frag.insert(0, nodes)
    })
    return { ok: true }
  },
}
