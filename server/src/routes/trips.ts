import { Router } from 'express'
import type { Server } from 'socket.io'
import { trips, createTrip, getTrip } from '../state/tripStore.js'
import { publicTrip, emitState, addEvent, now } from '../domain/events.js'
import { activateFallback } from '../domain/fallback.js'
import { point } from '../domain/geo.js'
import type { Participant } from '../types.js'
import { randomUUID } from 'node:crypto'

export function createTripsRouter(io: Server) {
  const router = Router()

  router.get('/health', (_req, res) => res.json({ ok: true }))

  router.get('/state', (_req, res) => res.json({ trips: [...trips.values()].map(publicTrip) }))

  router.post('/trips', (req, res) => {
    res.status(201).json({ trip: publicTrip(createTrip(req.body || {})) })
  })

  router.post('/trips/:id/join', (req, res) => {
    const trip = getTrip(req.params.id)
    if (!trip) return res.status(404).json({ error: 'Trip not found' })
    const role = req.body?.role === 'driver' ? 'driver' : 'passenger'
    if (role === 'driver') {
      trip.driver.online = true
      trip.driver.name = req.body?.name || trip.driver.name
    } else {
      const passenger: Participant = {
        id: randomUUID(),
        name: req.body?.name || `Passenger ${trip.passengers.length + 1}`,
        role,
        location: trip.route[0],
        lastSeen: now(),
        online: true,
        updates: 1,
      }
      trip.passengers.push(passenger)
      addEvent(trip, 'join', `${passenger.name} joined`, 'Passenger check-in received')
    }
    emitState(io, trips)
    res.json({ trip: publicTrip(trip) })
  })

  router.post('/trips/:id/action', (req, res) => {
    const trip = getTrip(req.params.id)
    if (!trip) return res.status(404).json({ error: 'Trip not found' })
    const action = req.body?.action as string
    if (action === 'fail') {
      trip.lostDriverLocation = { ...trip.driver.location }
      trip.status = 'grace'
      trip.failureAt = now()
      trip.driver.online = false
      addEvent(trip, 'alert', 'Driver signal lost', 'Grace period started · looking for the driver')
      emitState(io, trips)
      setTimeout(() => activateFallback(trip, io), 6000)
    } else if (action === 'restore') {
      if (trip.status !== 'grace' && trip.status !== 'fallback') {
        return res.status(409).json({ error: 'Driver is already connected' })
      }
      trip.status = 'restored'
      trip.driver.online = true
      trip.driver.lastSeen = now()
      trip.currentLocation = trip.driver.location
      trip.trackingSource = 'driver'
      delete trip.lostDriverLocation
      addEvent(trip, 'validation', 'Driver restored', 'Signal recovered; trip continues normally')
    } else if (action === 'validate') {
      activateFallback(trip, io)
    } else if (action === 'end') {
      trip.status = 'ended'
      addEvent(trip, 'trip', 'Trip ended', 'Everyone has been notified')
    } else if (action === 'move') {
      const next = Math.min(trip.route.findIndex((p) => p.lat === trip.currentLocation.lat) + 1 || 1, trip.route.length - 1)
      if (trip.status === 'fallback') {
        const cluster = trip.passengers.filter((p) => p.online)
        cluster.forEach((p) => {
          const clusterPoint = trip.route[Math.min(next, trip.route.length - 1)]
          p.location = point(clusterPoint.lat + 0.0006, clusterPoint.lng + 0.0006)
          p.lastSeen = now()
          p.updates += 1
        })
        if (cluster.length > 0) {
          trip.currentLocation = point(
            cluster.reduce((sum, p) => sum + p.location.lat, 0) / cluster.length,
            cluster.reduce((sum, p) => sum + p.location.lng, 0) / cluster.length,
          )
        }
      } else {
        trip.driver.location = trip.route[next]
        trip.driver.lastSeen = now()
        trip.currentLocation = trip.driver.location
      }
      if (trip.status !== 'fallback') {
        trip.passengers.forEach((p) => {
          p.location = point(trip.route[next].lat + 0.0006, trip.route[next].lng + 0.0006)
          p.lastSeen = now()
          p.updates += 1
        })
      }
      addEvent(trip, 'location', 'Location ping', 'Simulated driver and passenger locations updated')
    }
    emitState(io, trips)
    res.json({ trip: publicTrip(trip) })
  })

  return router
}
