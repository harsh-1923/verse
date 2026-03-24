import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createAuthMiddleware } from '../middleware/auth.js'

describe('authMiddleware', () => {
  function setup(verifyImpl: (token: string) => Promise<{ payload: { sub?: string } }>) {
    const authMiddleware = createAuthMiddleware(verifyImpl)
    const app = express()
    app.use(express.json())
    app.get('/protected', authMiddleware, (req, res) => {
      res.json({ userId: req.userId })
    })
    return app
  }

  it('returns 401 when Authorization header is missing', async () => {
    const app = setup(() => Promise.resolve({ payload: { sub: 'user' } }))
    const res = await request(app).get('/protected')
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/Missing or invalid/)
  })

  it('returns 401 when token is invalid', async () => {
    const app = setup(() => Promise.reject(new Error('invalid signature')))
    const res = await request(app).get('/protected').set('Authorization', 'Bearer bad-token')
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Invalid token')
  })

  it('calls next and sets userId on valid token', async () => {
    const app = setup(() => Promise.resolve({ payload: { sub: 'user-123' } }))
    const res = await request(app).get('/protected').set('Authorization', 'Bearer valid-token')
    expect(res.status).toBe(200)
    expect(res.body.userId).toBe('user-123')
  })

  it('returns 401 when Authorization header does not start with Bearer', async () => {
    const app = setup(() => Promise.resolve({ payload: { sub: 'user' } }))
    const res = await request(app).get('/protected').set('Authorization', 'Basic dXNlcjpwYXNz')
    expect(res.status).toBe(401)
  })

  it('sets userId to undefined when sub is not a string', async () => {
    const app = setup(() => Promise.resolve({ payload: { sub: undefined } }))
    const res = await request(app).get('/protected').set('Authorization', 'Bearer token')
    expect(res.status).toBe(200)
    expect(res.body.userId).toBeUndefined()
  })
})
