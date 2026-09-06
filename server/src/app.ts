import express from 'express'
import cors from 'cors'
import type { Server } from 'socket.io'
import { createTripsRouter } from './routes/trips.js'
import { errorHandler } from './middleware/errorHandler.js'
import { config } from './config.js'

export function createApp(io: Server) {
  const app = express()
  app.use(cors({ origin: config.corsOrigin }))
  app.use(express.json())
  app.use('/api', createTripsRouter(io))
  app.use(errorHandler)
  return app
}
