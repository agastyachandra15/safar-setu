import type { Server } from 'socket.io'
import { trips } from '../state/tripStore.js'
import { publicTrip } from '../domain/events.js'

export function registerSocketHandlers(io: Server) {
  io.on('connection', (socket) => {
    socket.emit('state', { trips: [...trips.values()].map(publicTrip) })
    socket.on('join-trip', (id: string) => socket.join(id))
  })
}
