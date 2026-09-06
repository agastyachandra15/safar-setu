import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { createApp } from './app.js'
import { registerSocketHandlers } from './sockets/index.js'
import { config } from './config.js'

const httpServer = createServer()
const io = new Server(httpServer, { cors: { origin: config.corsOrigin } })
const app = createApp(io)
httpServer.on('request', app)

registerSocketHandlers(io)

httpServer.listen(config.port, () => {
  console.log(`Safar Setu API listening on http://localhost:${config.port}`)
})
