import { Router, type IRouter, type Request, type Response } from 'express'
import multer from 'multer'
import * as Y from 'yjs'
import { authMiddleware } from '../middleware/auth.js'
import { hocuspocusServer } from '../collab/hocuspocus.js'

export const exportRouter: IRouter = Router()

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

exportRouter.post('/md', authMiddleware, (req: Request, res: Response) => {
  const { docId } = req.body as { docId?: string }
  if (!docId) {
    res.status(400).json({ error: 'Missing docId' })
    return
  }
  const doc = hocuspocusServer.documents.get(docId)
  const markdown = doc ? doc.getText('content').toString() : ''
  res.json({ markdown })
})

exportRouter.post('/import', authMiddleware, upload.single('file'), (req: Request, res: Response) => {
  const { docId } = req.body as { docId?: string }
  if (!docId) {
    res.status(400).json({ error: 'Missing docId' })
    return
  }
  if (!req.file) {
    res.status(400).json({ error: 'Missing file' })
    return
  }
  const content = req.file.buffer.toString('utf-8')
  const doc = hocuspocusServer.documents.get(docId) ?? new Y.Doc()
  const yText = doc.getText('content')
  doc.transact(() => {
    yText.delete(0, yText.length)
    yText.insert(0, content)
  })
  res.json({ ok: true, chars: content.length })
})
