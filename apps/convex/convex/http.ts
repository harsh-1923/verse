import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { api } from './_generated/api'
import { auth } from './auth'

const http = httpRouter()

auth.addHttpRoutes(http)

http.route({
  path: '/yjs-snapshot',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const serviceKey = request.headers.get('x-service-key')
    if (!serviceKey || serviceKey !== process.env.CONVEX_SERVICE_KEY) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const body = (await request.json()) as { docId: string; update: string }
    if (!body.docId || !body.update) {
      return new Response(JSON.stringify({ error: 'Missing docId or update' }), { status: 400 })
    }
    await ctx.runMutation(api.documents.saveYjsSnapshot, {
      docId: body.docId,
      update: body.update,
    })
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }),
})

export default http
