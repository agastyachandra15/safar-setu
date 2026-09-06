import { test, expect } from '@playwright/test'
import { io, Socket } from 'socket.io-client'

const API_URL = 'http://localhost:4000'

const api = async (path: string, options?: RequestInit) => {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!response.ok) throw new Error(`API error: ${response.status}`)
  return response.json()
}

let sharedSocket: Socket | null = null

test.describe.serial('Demo Mode - Fallback Route Progression', () => {
  let tripId: string

  // 14-waypoint demo route: Bandra West → Dadar (Mumbai)

  test.beforeAll(async () => {
    sharedSocket = io(API_URL, { reconnection: true })
    await new Promise(resolve => sharedSocket?.on('connect', resolve))
  })

  test.afterAll(async () => {
    if (sharedSocket) sharedSocket.disconnect()
  })

  test('create demo trip', async () => {
    const data = await api('/api/trips', {
      method: 'POST',
      body: JSON.stringify({ demoMode: true }),
    })

    expect(data.trip).toBeDefined()
    expect(data.trip.demoMode).toBe(true)
    expect(data.trip.routeIndex).toBe(0)
    expect(data.trip.route.length).toBe(14)
    expect(data.trip.status).toBe('active')

    tripId = data.trip.id
    console.log(`✓ Created demo trip: ${tripId} with 14-waypoint route`)
  })

  test('move in active state progresses route', async () => {
    let data = await api(`/api/trips/${tripId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action: 'move' }),
    })
    expect(data.trip.routeIndex).toBe(1)

    data = await api(`/api/trips/${tripId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action: 'move' }),
    })
    expect(data.trip.routeIndex).toBe(2)

    data = await api(`/api/trips/${tripId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action: 'move' }),
    })
    expect(data.trip.routeIndex).toBe(3)

    console.log('✓ Route index progresses: 0→1→2→3')
  })

  test('trigger fallback with grace period', async () => {
    const data = await api(`/api/trips/${tripId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action: 'fail' }),
    })

    expect(data.trip.status).toBe('grace')
    expect(data.trip.driver.online).toBe(false)
    expect(data.trip.routeIndex).toBe(3) // unchanged

    console.log('✓ Driver signal lost, grace period started')
  })

  test('fallback activates with passenger cluster', async () => {
    // Wait for grace period + activation
    await new Promise(resolve => setTimeout(resolve, 7000))

    const data = await api('/api/state')
    const trip = data.trips.find((t: any) => t.id === tripId)

    expect(trip.status).toBe('fallback')
    expect(trip.trackingSource).toBe('passenger-fallback')
    expect(trip.currentLocation).toBeDefined()

    console.log(`✓ Fallback activated with centroid at routeIndex ${trip.routeIndex}`)
  })

  test('fallback move progresses route forward (KEY TEST)', async () => {
    let data = await api('/api/state')
    let trip = data.trips.find((t: any) => t.id === tripId)
    const indexBeforeMove = trip.routeIndex

    // Move in fallback - should progress forward
    const moveRes = await api(`/api/trips/${tripId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action: 'move' }),
    })

    expect(moveRes.trip.routeIndex).toBe(indexBeforeMove + 1)
    expect(moveRes.trip.status).toBe('fallback')

    // Move again - should continue forward, not reset
    const moveRes2 = await api(`/api/trips/${tripId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action: 'move' }),
    })

    expect(moveRes2.trip.routeIndex).toBe(indexBeforeMove + 2)

    console.log(`✓ Fallback moves progress forward: ${indexBeforeMove}→${indexBeforeMove + 1}→${indexBeforeMove + 2}`)
  })

  test('driver restoration returns to driver tracking', async () => {
    const data = await api(`/api/trips/${tripId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action: 'restore' }),
    })

    expect(data.trip.status).toBe('restored')
    expect(data.trip.driver.online).toBe(true)
    expect(data.trip.trackingSource).toBe('driver')

    console.log('✓ Driver restored, tracking source back to driver')
  })

  test('end trip completes flow', async () => {
    const data = await api(`/api/trips/${tripId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action: 'end' }),
    })

    expect(data.trip.status).toBe('ended')
    console.log('✓ Trip ended successfully')
  })
})
