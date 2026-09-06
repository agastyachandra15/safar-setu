export type Role = 'landing' | 'driver' | 'passenger' | 'relative' | 'admin'
export type Status = 'active' | 'grace' | 'fallback' | 'restored' | 'ended'
export type Point = { lat: number; lng: number }
export type Person = {
  id: string
  name: string
  role: 'driver' | 'passenger'
  location: Point
  lastSeen: string
  online: boolean
  updates: number
}
export type TripEvent = { id: string; at: string; kind: string; title: string; detail: string }
export type Trip = {
  id: string
  shortId: string
  name: string
  origin: string
  destination: string
  route: Point[]
  status: Status
  currentLocation?: Point
  trackingSource?: 'driver' | 'passenger-fallback'
  lostDriverLocation?: Point
  driver: Person
  passengers: Person[]
  events: TripEvent[]
  createdAt: string
  demoMode: boolean
}
