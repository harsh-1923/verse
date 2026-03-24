import express, { type Express } from 'express'
import cors from 'cors'
import http from 'http'
import { WebSocketServer } from 'ws'
import { config } from './config.js'
import { agentRouter } from './agent/orchestrator.js'
import { exportRouter } from './export/routes.js'
import { errorHandler } from './middleware/errorHandler.js'
import { hocuspocusServer } from './collab/hocuspocus.js'
import { setHocuspocusServer } from './agent/tools/yjsTools.js'

const app: Express = express()

app.use(cors({ origin: config.allowedOrigin }))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true, timestamp: Date.now() })
})

app.use('/agent', agentRouter)
app.use('/export', exportRouter)

app.use(errorHandler)

const server = http.createServer(app)
const wss = new WebSocketServer({ noServer: true })

setHocuspocusServer(hocuspocusServer)

server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    hocuspocusServer.handleConnection(ws, req)
  })
})

server.listen(config.port, () => {
  console.log(`[server] listening on port ${config.port}`)
})

export { app, server }
