import express from 'express'
import cors from 'cors'
import type { Server } from 'socket.io'
import { TripRepository } from './repositories/tripRepository.js'
import { TripService } from './services/tripService.js'
import { createTripsRouter } from './routes/trips.js'
import { errorHandler } from './middleware/errorHandler.js'
import { config } from './config.js'

export function createApp(io: Server) {
  const app = express()

  // Instantiate repository and service
  const tripRepository = new TripRepository()
  const tripService = new TripService(tripRepository, io)

  // Middleware (only for non-Socket.IO routes)
  app.use(cors({ origin: config.corsOrigin }))
  app.use(express.json())

  // Routes (inject service)
  app.use('/api', createTripsRouter(tripService))

  // Handle 404 for API routes
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })

  // Error handler
  app.use(errorHandler)

  // Return app with references for socket setup
  return { app, tripRepository, tripService }
}
