import type { Server } from 'socket.io'
import type { Trip, Participant } from '../types.js'
import type { TripRepository } from '../repositories/tripRepository.js'
import { point } from '../domain/geo.js'
import { addEvent, publicTrip, emitState, now } from '../domain/events.js'
import { activateFallback } from '../domain/fallback.js'
import { randomUUID } from 'node:crypto'

const route = [
  point(19.076, 72.8777),
  point(19.082, 72.889),
  point(19.092, 72.897),
  point(19.103, 72.906),
  point(19.115, 72.916),
  point(19.125, 72.925),
]

export class TripService {
  constructor(private tripRepository: TripRepository, private io: Server) {}

  // Business logic: create a new trip
  createTrip(input: { name?: string; origin?: string; destination?: string; demoMode?: boolean }): Trip {
    const id = randomUUID()
    const created = now()
    const driver: Participant = {
      id: randomUUID(),
      name: 'Aarav (driver)',
      role: 'driver',
      location: route[0],
      lastSeen: created,
      online: true,
      updates: 1,
    }
    const trip: Trip = {
      id,
      shortId: id.slice(0, 6).toUpperCase(),
      name: input.name || 'Mumbai morning shuttle',
      origin: input.origin || 'Bandra West',
      destination: input.destination || 'Powai Lake',
      route,
      status: 'active',
      currentLocation: route[0],
      trackingSource: 'driver',
      driver,
      passengers: [],
      createdAt: created,
      events: [],
      demoMode: Boolean(input.demoMode),
    }
    addEvent(trip, 'trip', 'Trip generated', `${trip.origin} → ${trip.destination}`)

    // Demo mode: add sample passengers
    if (trip.demoMode) {
      ;['Meera', 'Kabir', 'Nisha'].forEach((name, index) => {
        const passenger: Participant = {
          id: randomUUID(),
          name,
          role: 'passenger',
          location: point(route[0].lat + index * 0.0002, route[0].lng + index * 0.0002),
          lastSeen: created,
          online: true,
          updates: trip.demoMode ? 2 : 1,
        }
        trip.passengers.push(passenger)
        addEvent(trip, 'join', `${name} joined`, 'Demo passenger connected to this trip')
      })
      addEvent(trip, 'system', 'Demo mode ready', 'Simulated people and driver are ready to move')
    }

    this.tripRepository.create(trip)
    emitState(this.io, this.tripRepository.getStorage())
    return trip
  }

  // Business logic: join a trip
  joinTrip(tripId: string, input: { name?: string; role: 'driver' | 'passenger' }): Trip | null {
    const trip = this.tripRepository.getById(tripId)
    if (!trip) return null

    if (input.role === 'driver') {
      trip.driver.online = true
      trip.driver.name = input.name || trip.driver.name
    } else {
      const passenger: Participant = {
        id: randomUUID(),
        name: input.name || `Passenger ${trip.passengers.length + 1}`,
        role: 'passenger',
        location: trip.route[0],
        lastSeen: now(),
        online: true,
        updates: 1,
      }
      trip.passengers.push(passenger)
      addEvent(trip, 'join', `${passenger.name} joined`, 'Passenger check-in received')
    }

    this.tripRepository.save(trip)
    emitState(this.io, this.tripRepository.getStorage())
    return trip
  }

  // Business logic: handle trip actions (fail, restore, validate, end, move)
  handleAction(tripId: string, action: string): Trip | null {
    const trip = this.tripRepository.getById(tripId)
    if (!trip) return null

    if (action === 'fail') {
      trip.lostDriverLocation = { ...trip.driver.location }
      trip.status = 'grace'
      trip.failureAt = now()
      trip.driver.online = false
      addEvent(trip, 'alert', 'Driver signal lost', 'Grace period started · looking for the driver')
      this.tripRepository.save(trip)
      emitState(this.io, this.tripRepository.getStorage())
      setTimeout(() => activateFallback(trip, this.io), 6000)
    } else if (action === 'restore') {
      if (trip.status !== 'grace' && trip.status !== 'fallback') return null
      trip.status = 'restored'
      trip.driver.online = true
      trip.driver.lastSeen = now()
      trip.currentLocation = trip.driver.location
      trip.trackingSource = 'driver'
      delete trip.lostDriverLocation
      addEvent(trip, 'validation', 'Driver restored', 'Signal recovered; trip continues normally')
    } else if (action === 'validate') {
      activateFallback(trip, this.io)
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

    this.tripRepository.save(trip)
    emitState(this.io, this.tripRepository.getStorage())
    return trip
  }

  // Queries
  getTripById(id: string): Trip | undefined {
    return this.tripRepository.getById(id)
  }

  getAllTrips(): Trip[] {
    return this.tripRepository.getAll()
  }
}
