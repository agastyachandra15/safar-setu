import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { createApp } from './app.js'
import { registerSocketHandlers } from './sockets/index.js'
import { config } from './config.js'

const httpServer = createServer()
const io = new Server(httpServer, { cors: { origin: config.corsOrigin } })

const { app, tripRepository } = createApp(io)

// Attach Express to HTTP server with proper Socket.IO integration
// Only pass non-Socket.IO requests to Express
httpServer.on('request', (req, res) => {
  // Let Socket.IO handle polling and WebSocket upgrade requests
  if (req.url?.includes('socket.io')) {
    return
  }
  app(req, res)
})

// Register socket handlers with repository
registerSocketHandlers(io, tripRepository)

httpServer.listen(config.port, () => {
  console.log(`Safar Setu API listening on http://localhost:${config.port}`)
})
