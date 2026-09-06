import type { Server } from 'socket.io'
import type { Trip } from '../types.js'
import { point } from './geo.js'
import { distanceMeters } from './geo.js'
import { addEvent, emitState } from './events.js'
import { trips } from '../state/tripStore.js'

export function activateFallback(trip: Trip, io: Server) {
  if (trip.status !== 'grace') return
  const group = trip.passengers.filter((passenger) => passenger.online && passenger.updates >= 2)
  const nearLastKnown = group.filter((passenger) => distanceMeters(passenger.location, trip.driver.location) <= 250)
  const cluster = nearLastKnown.filter((passenger) =>
    nearLastKnown.every((other) => distanceMeters(passenger.location, other.location) <= 250),
  )
  if (cluster.length < 2) {
    addEvent(trip, 'validation', 'Cluster not verified', 'Waiting for at least two consistent passengers within 250 m')
    emitState(io, trips)
    return
  }
  const centroid = point(
    cluster.reduce((sum, passenger) => sum + passenger.location.lat, 0) / cluster.length,
    cluster.reduce((sum, passenger) => sum + passenger.location.lng, 0) / cluster.length,
  )
  trip.status = 'fallback'
  trip.currentLocation = centroid
  trip.trackingSource = 'passenger-fallback'
  addEvent(trip, 'validation', 'Passenger cluster verified', `Centroid of ${cluster.length} same-trip passengers is now the approximate location`)
  addEvent(trip, 'system', 'Passenger-assisted tracking active', 'Driver signal is unavailable; approximate tracking continues')
  emitState(io, trips)
}
