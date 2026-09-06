import type { Point } from '../types.js'

export const point = (lat: number, lng: number): Point => ({ lat, lng })

export function distanceMeters(a: Point, b: Point) {
  const earthRadius = 6371000
  const lat = ((b.lat - a.lat) * Math.PI) / 180
  const lng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const haversine = Math.sin(lat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(lng / 2) ** 2
  return 2 * earthRadius * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}
