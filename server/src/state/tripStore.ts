import { randomUUID } from 'node:crypto'
import type { Participant, Point, Trip } from '../types.js'
import { point } from '../domain/geo.js'
import { addEvent, now } from '../domain/events.js'

export const trips = new Map<string, Trip>()

export const route: Point[] = [
  point(19.076, 72.8777),
  point(19.082, 72.889),
  point(19.092, 72.897),
  point(19.103, 72.906),
  point(19.115, 72.916),
  point(19.125, 72.925),
]

export function createTrip(input: { name?: string; origin?: string; destination?: string; demoMode?: boolean }) {
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
  trips.set(id, trip)
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
  return trip
}

export function getTrip(id: string) {
  return trips.get(id)
}
