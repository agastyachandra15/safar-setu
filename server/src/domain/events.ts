import { randomUUID } from 'node:crypto'
import type { Server } from 'socket.io'
import type { EventKind, Trip } from '../types.js'

export const now = () => new Date().toISOString()

export function addEvent(trip: Trip, kind: EventKind, title: string, detail: string) {
  trip.events.unshift({ id: randomUUID(), at: now(), kind, title, detail })
}

export function publicTrip(trip: Trip) {
  return { ...trip, events: trip.events.slice(0, 40) }
}

export function emitState(io: Server, trips: Map<string, Trip>) {
  io.emit('state', { trips: [...trips.values()].map(publicTrip) })
}
