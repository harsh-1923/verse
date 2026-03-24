import { Hocuspocus } from '@hocuspocus/server'
import type { onAuthenticatePayload, onChangePayload, onLoadDocumentPayload, onStoreDocumentPayload } from '@hocuspocus/server'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import * as Y from 'yjs'
import { config } from '../config.js'

const getJWKS = () =>
  createRemoteJWKSet(new URL(`${config.convexJwksUrl}/.well-known/jwks.json`))

const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()

async function persistSnapshot(documentName: string, document: Y.Doc): Promise<void> {
  if (!config.convexAdminKey) return
  const update = Buffer.from(Y.encodeStateAsUpdate(document)).toString('base64')
  try {
    await fetch(`${config.convexUrl}/api/mutation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: 'documents:saveYjsSnapshot',
        args: { docId: documentName, update },
        adminKey: config.convexAdminKey,
      }),
    })
  } catch (_e) {
    void _e
  }
}

export const hocuspocusServer = new Hocuspocus({
  async onAuthenticate({ token }: onAuthenticatePayload) {
    if (!token) throw new Error('Missing token')
    const { payload } = await jwtVerify(token, getJWKS(), {
      issuer: config.convexSiteUrl,
      audience: 'convex',
    })
    return { userId: payload.sub ?? 'unknown' }
  },

  async onLoadDocument({ document, documentName }: onLoadDocumentPayload) {
    if (!config.convexUrl) return
    try {
      const res = await fetch(`${config.convexUrl}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: 'documents:getYjsSnapshot',
          args: { docId: documentName },
          adminKey: config.convexAdminKey,
        }),
      })
      if (!res.ok) return
      const data = (await res.json()) as { value?: { update?: string } | null }
      const update = data?.value?.update
      if (update) {
        Y.applyUpdate(document, Buffer.from(update, 'base64'))
      }
    } catch (_e) {
      void _e
    }
  },

  async onChange({ document, documentName }: onChangePayload) {
    const existing = debounceTimers.get(documentName)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      debounceTimers.delete(documentName)
      void persistSnapshot(documentName, document)
    }, 3000)
    debounceTimers.set(documentName, timer)
  },

  async onStoreDocument({ document, documentName }: onStoreDocumentPayload) {
    const existing = debounceTimers.get(documentName)
    if (existing) {
      clearTimeout(existing)
      debounceTimers.delete(documentName)
    }
    await persistSnapshot(documentName, document)
  },
})
