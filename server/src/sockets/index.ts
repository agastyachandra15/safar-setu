import type { Server } from 'socket.io'
import type { TripRepository } from '../repositories/tripRepository.js'
import { publicTrip } from '../domain/events.js'

export function registerSocketHandlers(io: Server, tripRepository: TripRepository) {
  io.on('connection', (socket) => {
    socket.emit('state', { trips: tripRepository.getAll().map(publicTrip) })
    socket.on('join-trip', (id: string) => socket.join(id))
  })
}
