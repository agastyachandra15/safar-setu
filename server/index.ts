import express from 'express'
import cors from 'cors'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { randomUUID } from 'node:crypto'

type Role = 'driver' | 'passenger' | 'relative' | 'admin'
type TripStatus = 'active' | 'grace' | 'fallback' | 'restored' | 'ended'
type EventKind = 'trip' | 'join' | 'location' | 'alert' | 'validation' | 'system'

type Point = { lat: number; lng: number }
type Participant = { id: string; name: string; role: Exclude<Role, 'admin' | 'relative'>; location: Point; lastSeen: string; online: boolean; updates: number }
type TripEvent = { id: string; at: string; kind: EventKind; title: string; detail: string }
type Trip = {
  id: string
  shortId: string
  name: string
  origin: string
  destination: string
  route: Point[]
  status: TripStatus
  currentLocation: Point
  trackingSource: 'driver' | 'passenger-fallback'
  lostDriverLocation?: Point
  driver: Participant
  passengers: Participant[]
  createdAt: string
  failureAt?: string
  events: TripEvent[]
  demoMode: boolean
}

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, { cors: { origin: '*' } })
app.use(cors())
app.use(express.json())

const trips = new Map<string, Trip>()
const now = () => new Date().toISOString()
const point = (lat: number, lng: number): Point => ({ lat, lng })
const route: Point[] = [
  point(19.076, 72.8777), point(19.082, 72.889), point(19.092, 72.897),
  point(19.103, 72.906), point(19.115, 72.916), point(19.125, 72.925)
]

function addEvent(trip: Trip, kind: EventKind, title: string, detail: string) {
  trip.events.unshift({ id: randomUUID(), at: now(), kind, title, detail })
}

function publicTrip(trip: Trip) {
  return { ...trip, events: trip.events.slice(0, 40) }
}

function emitState() {
  io.emit('state', { trips: [...trips.values()].map(publicTrip) })
}

function createTrip(input: { name?: string; origin?: string; destination?: string; demoMode?: boolean }) {
  const id = randomUUID()
  const created = now()
  const driver: Participant = {
    id: randomUUID(), name: 'Aarav (driver)', role: 'driver',
    location: route[0], lastSeen: created, online: true, updates: 1
  }
  const trip: Trip = {
    id, shortId: id.slice(0, 6).toUpperCase(),
    name: input.name || 'Mumbai morning shuttle',
    origin: input.origin || 'Bandra West',
    destination: input.destination || 'Powai Lake',
    route, status: 'active', currentLocation: route[0], trackingSource: 'driver', driver, passengers: [], createdAt: created,
    events: [], demoMode: Boolean(input.demoMode)
  }
  addEvent(trip, 'trip', 'Trip generated', `${trip.origin} → ${trip.destination}`)
  trips.set(id, trip)
  if (trip.demoMode) {
    ;['Meera', 'Kabir', 'Nisha'].forEach((name, index) => {
      const passenger: Participant = {
        id: randomUUID(), name, role: 'passenger', location: point(route[0].lat + index * 0.0002, route[0].lng + index * 0.0002),
        lastSeen: created, online: true, updates: trip.demoMode ? 2 : 1
      }
      trip.passengers.push(passenger)
      addEvent(trip, 'join', `${name} joined`, 'Demo passenger connected to this trip')
    })
    addEvent(trip, 'system', 'Demo mode ready', 'Simulated people and driver are ready to move')
  }
  return trip
}

function getTrip(id: string) {
  return trips.get(id)
}

function distanceMeters(a: Point, b: Point) {
  const earthRadius = 6371000
  const lat = (b.lat - a.lat) * Math.PI / 180
  const lng = (b.lng - a.lng) * Math.PI / 180
  const lat1 = a.lat * Math.PI / 180
  const lat2 = b.lat * Math.PI / 180
  const haversine = Math.sin(lat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(lng / 2) ** 2
  return 2 * earthRadius * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

function activateFallback(trip: Trip) {
  if (trip.status !== 'grace') return
  const group = trip.passengers.filter((passenger) => passenger.online && passenger.updates >= 2)
  const nearLastKnown = group.filter((passenger) => distanceMeters(passenger.location, trip.driver.location) <= 250)
  const cluster = nearLastKnown.filter((passenger) =>
    nearLastKnown.every((other) => distanceMeters(passenger.location, other.location) <= 250),
  )
  if (cluster.length < 2) {
    addEvent(trip, 'validation', 'Cluster not verified', 'Waiting for at least two consistent passengers within 250 m')
    emitState()
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
  emitState()
}

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.get('/api/state', (_req, res) => res.json({ trips: [...trips.values()].map(publicTrip) }))
app.post('/api/trips', (req, res) => res.status(201).json({ trip: publicTrip(createTrip(req.body || {})) }))
app.post('/api/trips/:id/join', (req, res) => {
  const trip = getTrip(req.params.id)
  if (!trip) return res.status(404).json({ error: 'Trip not found' })
  const role = req.body?.role === 'driver' ? 'driver' : 'passenger'
  if (role === 'driver') {
    trip.driver.online = true
    trip.driver.name = req.body?.name || trip.driver.name
  } else {
    const passenger: Participant = {
      id: randomUUID(), name: req.body?.name || `Passenger ${trip.passengers.length + 1}`, role,
      location: trip.route[0], lastSeen: now(), online: true, updates: 1
    }
    trip.passengers.push(passenger)
    addEvent(trip, 'join', `${passenger.name} joined`, 'Passenger check-in received')
  }
  emitState()
  res.json({ trip: publicTrip(trip) })
})

app.post('/api/trips/:id/action', (req, res) => {
  const trip = getTrip(req.params.id)
  if (!trip) return res.status(404).json({ error: 'Trip not found' })
  const action = req.body?.action as string
  if (action === 'fail') {
    trip.lostDriverLocation = { ...trip.driver.location }
    trip.status = 'grace'
    trip.failureAt = now()
    trip.driver.online = false
    addEvent(trip, 'alert', 'Driver signal lost', 'Grace period started · looking for the driver')
    emitState()
    setTimeout(() => activateFallback(trip), 6000)
  } else if (action === 'restore') {
    if (trip.status !== 'grace' && trip.status !== 'fallback') return res.status(409).json({ error: 'Driver is already connected' })
    trip.status = 'restored'
    trip.driver.online = true
    trip.driver.lastSeen = now()
    trip.currentLocation = trip.driver.location
    trip.trackingSource = 'driver'
    delete trip.lostDriverLocation
    addEvent(trip, 'validation', 'Driver restored', 'Signal recovered; trip continues normally')
  } else if (action === 'validate') {
    activateFallback(trip)
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
    if (trip.status !== 'fallback') trip.passengers.forEach((p) => {
      p.location = point(trip.route[next].lat + 0.0006, trip.route[next].lng + 0.0006)
      p.lastSeen = now()
      p.updates += 1
    })
    addEvent(trip, 'location', 'Location ping', 'Simulated driver and passenger locations updated')
  }
  emitState()
  res.json({ trip: publicTrip(trip) })
})

io.on('connection', (socket) => {
  socket.emit('state', { trips: [...trips.values()].map(publicTrip) })
  socket.on('join-trip', (id: string) => socket.join(id))
})

const port = Number(process.env.PORT || 4000)
httpServer.listen(port, () => console.log(`Safar Setu API listening on http://localhost:${port}`))
