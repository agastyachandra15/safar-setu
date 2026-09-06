import express from 'express'
import cors from 'cors'
import type { Server } from 'socket.io'
import { createTripsRouter } from './routes/trips.js'
import { errorHandler } from './middleware/errorHandler.js'
import { config } from './config.js'
import { TripRepository } from './repositories/tripRepository.js'
import { TripService } from './services/tripService.js'

export function createApp(io: Server) {
  const app = express()
  app.use(cors({ origin: config.corsOrigin }))
  app.use(express.json())

  // Initialize repository and service
  const tripRepository = new TripRepository()
  const tripService = new TripService(tripRepository, io)

  app.use('/api', createTripsRouter(tripService))
  app.use(errorHandler)
  return app
}
