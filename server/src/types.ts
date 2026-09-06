export type Role = 'driver' | 'passenger' | 'relative' | 'admin'
export type TripStatus = 'active' | 'grace' | 'fallback' | 'restored' | 'ended'
export type EventKind = 'trip' | 'join' | 'location' | 'alert' | 'validation' | 'system'

export type Point = { lat: number; lng: number }
export type Participant = {
  id: string
  name: string
  role: Exclude<Role, 'admin' | 'relative'>
  location: Point
  lastSeen: string
  online: boolean
  updates: number
}
export type TripEvent = { id: string; at: string; kind: EventKind; title: string; detail: string }
export type Trip = {
  id: string
  shortId: string
  name: string
  origin: string
  destination: string
  route: Point[]
  routeIndex: number
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
