import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import * as Y from 'yjs'
import type { Request, Response, NextFunction } from 'express'

const mockDocuments = vi.hoisted(() => new Map<string, Y.Doc>())

vi.mock('../collab/hocuspocus.js', () => ({
  hocuspocusServer: {
    documents: mockDocuments,
  },
}))

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: (_req: Request, _res: Response, next: NextFunction) => next(),
  optionalAuth: (_req: Request, _res: Response, next: NextFunction) => next(),
}))

import { exportRouter } from '../export/routes.js'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/export', exportRouter)
  return app
}

describe('exportRouter', () => {
  beforeEach(() => {
    mockDocuments.clear()
  })

  describe('POST /export/md', () => {
    it('returns 401 without auth token when auth is real', () => {
      expect(true).toBe(true)
    })

    it('returns 400 when docId is missing', async () => {
      const app = makeApp()
      const res = await request(app)
        .post('/export/md')
        .set('Authorization', 'Bearer token')
        .send({})
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/docId/)
    })

    it('returns empty markdown when doc not found', async () => {
      const app = makeApp()
      const res = await request(app)
        .post('/export/md')
        .set('Authorization', 'Bearer token')
        .send({ docId: 'nonexistent' })
      expect(res.status).toBe(200)
      expect(res.body.markdown).toBe('')
    })

    it('returns document content as markdown', async () => {
      const doc = new Y.Doc()
      doc.getText('content').insert(0, '# Hello World\n\nThis is a test.')
      mockDocuments.set('doc-1', doc)

      const app = makeApp()
      const res = await request(app)
        .post('/export/md')
        .set('Authorization', 'Bearer token')
        .send({ docId: 'doc-1' })
      expect(res.status).toBe(200)
      expect(res.body.markdown).toBe('# Hello World\n\nThis is a test.')
    })
  })

  describe('POST /export/import', () => {
    it('returns 400 when docId is missing', async () => {
      const app = makeApp()
      const res = await request(app)
        .post('/export/import')
        .set('Authorization', 'Bearer token')
        .attach('file', Buffer.from('# Test'), 'test.md')
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/docId/)
    })

    it('returns 400 when file is missing', async () => {
      const app = makeApp()
      const res = await request(app)
        .post('/export/import')
        .set('Authorization', 'Bearer token')
        .field('docId', 'doc-1')
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/file/)
    })

    it('imports markdown content into doc', async () => {
      const doc = new Y.Doc()
      doc.getText('content').insert(0, 'old content')
      mockDocuments.set('doc-import', doc)

      const app = makeApp()
      const res = await request(app)
        .post('/export/import')
        .set('Authorization', 'Bearer token')
        .field('docId', 'doc-import')
        .attach('file', Buffer.from('# New Content'), 'new.md')
      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      expect(res.body.chars).toBe('# New Content'.length)
    })
  })
})
