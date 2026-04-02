import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { Request, Response, NextFunction } from 'express'
import { config } from '../config.js'

type Verifier = (token: string) => Promise<{ payload: { sub?: string } }>

const getJWKS = () =>
  createRemoteJWKSet(new URL(`${config.convexJwksUrl}/.well-known/jwks.json`))

function defaultVerifier(token: string) {
  return jwtVerify(token, getJWKS(), {
    issuer: config.convexSiteUrl,
    audience: 'convex',
  }) as Promise<{ payload: { sub?: string } }>
}

export function createAuthMiddleware(verify: Verifier = defaultVerifier) {
  return async function (req: Request, res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' })
      return
    }
    const token = authHeader.slice(7)
    try {
      const { payload } = await verify(token)
      req.userId = typeof payload.sub === 'string' ? payload.sub : undefined
      next()
    } catch {
      res.status(401).json({ error: 'Invalid token' })
    }
  }
}

export function createOptionalAuth(verify: Verifier = defaultVerifier) {
  return async function (req: Request, _res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      try {
        const { payload } = await verify(token)
        req.userId = typeof payload.sub === 'string' ? payload.sub : undefined
      } catch (_e) {
        void _e
      }
    }
    next()
  }
}

export const authMiddleware = createAuthMiddleware()
export const optionalAuth = createOptionalAuth()
