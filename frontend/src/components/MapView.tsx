import { useEffect } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Trip } from '../types'

export function MapView({ trip, showPassengers = true }: { trip?: Trip; showPassengers?: boolean }) {
  useEffect(() => {
    const el = document.getElementById('trip-map')
    if (!el || !trip) return
    const currentLocation = trip.currentLocation || trip.driver.location
    const trackingSource = trip.trackingSource || (trip.status === 'fallback' ? 'passenger-fallback' : 'driver')
    const map = L.map(el, {
      zoomControl: false,
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
    }).setView([19.1, 72.9], 12)
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(map)
    const line = L.polyline(trip.route.map((p) => [p.lat, p.lng] as [number, number]), { color: '#f76c5e', weight: 5 }).addTo(map)
    const icon = (color: string, ring = false) =>
      L.divIcon({
        className: 'pin',
        html: `<span style="background:${color};${ring ? 'outline:3px solid #ffffff;box-shadow:0 0 0 2px #f76c5e;' : ''}"></span>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })
    const sourceColor = trackingSource === 'passenger-fallback' ? '#256879' : '#0d5c63'
    L.marker([currentLocation.lat, currentLocation.lng], { icon: icon(sourceColor) })
      .addTo(map)
      .bindTooltip(
        trackingSource === 'passenger-fallback' ? 'Passenger cluster centroid (approximate)' : 'Driver location',
        { permanent: false },
      )
    if (trip.lostDriverLocation && !trip.driver.online) {
      L.marker([trip.lostDriverLocation.lat, trip.lostDriverLocation.lng], { icon: icon('#f76c5e', true) })
        .addTo(map)
        .bindTooltip('Driver lost connection here', { permanent: false })
    }
    if (showPassengers) {
      trip.passengers.forEach((p) => L.marker([p.location.lat, p.location.lng], { icon: icon('#f76c5e') }).addTo(map).bindTooltip(p.name))
    }
    map.fitBounds(line.getBounds(), { padding: [20, 20] })
    return () => {
      map.stop()
      map.off()
      if (map.getContainer()) map.remove()
    }
  }, [trip, showPassengers])
  return <div id="trip-map" className="map" />
}
