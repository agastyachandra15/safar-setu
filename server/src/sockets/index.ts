import type { Server } from 'socket.io'
import type { TripRepository } from '../repositories/tripRepository.js'
import { publicTrip } from '../domain/events.js'

export function registerSocketHandlers(io: Server, tripRepository: TripRepository) {
  io.on('connection', (socket) => {
    // Send current state on connection
    const trips = tripRepository.getAll()
    socket.emit('state', { trips: trips.map(publicTrip) })

    // Join a specific trip's room
    socket.on('join-trip', (id: string) => {
      socket.join(id)
    })
  })
}
