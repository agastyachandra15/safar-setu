import { Router } from 'express'
import type { TripService } from '../services/tripService.js'
import { publicTrip } from '../domain/events.js'

export function createTripsRouter(tripService: TripService) {
  const router = Router()

  // Health check
  router.get('/health', (_req, res) => {
    res.json({ ok: true })
  })

  // Get all trips
  router.get('/state', (_req, res) => {
    const trips = tripService.getAllTrips()
    res.json({ trips: trips.map(publicTrip) })
  })

  // Create a new trip
  router.post('/trips', (req, res) => {
    const trip = tripService.createTrip(req.body || {})
    res.status(201).json({ trip: publicTrip(trip) })
  })

  // Join a trip
  router.post('/trips/:id/join', (req, res) => {
    const trip = tripService.joinTrip(req.params.id, {
      name: req.body?.name,
      role: req.body?.role === 'driver' ? 'driver' : 'passenger',
    })
    if (!trip) return res.status(404).json({ error: 'Trip not found' })
    res.json({ trip: publicTrip(trip) })
  })

  // Handle trip actions
  router.post('/trips/:id/action', (req, res) => {
    const trip = tripService.handleAction(req.params.id, req.body?.action)
    if (!trip) {
      if (req.body?.action === 'restore' && tripService.getTripById(req.params.id)?.status === 'active') {
        return res.status(409).json({ error: 'Driver is already connected' })
      }
      return res.status(404).json({ error: 'Trip not found' })
    }
    res.json({ trip: publicTrip(trip) })
  })

  return router
}
