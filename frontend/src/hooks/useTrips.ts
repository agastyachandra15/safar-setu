import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { api } from '../lib/api'
import type { Trip } from '../types'

export function useTrips() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [error, setError] = useState('')

  const refresh = () => api('/api/state').then((data) => setTrips(data.trips)).catch((e) => setError(e.message))

  useEffect(() => {
    refresh()
    const socket = io()
    socket.on('state', (data: { trips: Trip[] }) => setTrips(data.trips))
    return () => {
      socket.disconnect()
    }
  }, [])

  return { trips, setTrips, error, setError, refresh }
}
