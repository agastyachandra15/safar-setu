# Business Logic Layer Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the three-layer architecture (repository, service, controller) for the server backend, centralizing business logic in a service layer and making controllers thin HTTP handlers.

**Architecture:** Repository (CRUD) → Service (all logic) → Controllers (HTTP only), with socket handlers reading directly from repository.

**Tech Stack:** TypeScript, Express, in-memory Map with repository abstraction, dependency injection.

**Spec:** `docs/superpowers/specs/2026-09-06-business-logic-layers-design.md`

## Global Constraints

- No behavior changes — trip lifecycle, REST contract, socket events, in-memory state identical to original.
- Existing domain utilities (`geo.ts`, `events.ts`, `fallback.ts`) reused, not refactored.
- All business logic centralizes in `TripService`.
- Socket handlers read directly from repository for performance.
- All writes go through service layer.

---

### Task 1: Base Repository

**Files:**
- Create: `server/src/repositories/baseRepository.ts`

**Interfaces:**
- Produces: `BaseRepository<T>` abstract class with generic CRUD methods (`create`, `getById`, `getAll`, `save`, `update`, `delete`, `exists`).

- [ ] **Step 1: Create repositories directory**

Run: `mkdir -p server/src/repositories`
Expected: directory created.

- [ ] **Step 2: Write base repository**

Create `server/src/repositories/baseRepository.ts` with exact content:

```ts
export abstract class BaseRepository<T extends { id: string }> {
  protected storage = new Map<string, T>()

  create(entity: T): void {
    this.storage.set(entity.id, entity)
  }

  getById(id: string): T | undefined {
    return this.storage.get(id)
  }

  getAll(): T[] {
    return [...this.storage.values()]
  }

  save(entity: T): void {
    this.storage.set(entity.id, entity)
  }

  update(id: string, entity: T): void {
    if (!this.storage.has(id)) throw new Error(`Entity with id ${id} not found`)
    this.storage.set(id, entity)
  }

  delete(id: string): void {
    this.storage.delete(id)
  }

  exists(id: string): boolean {
    return this.storage.has(id)
  }
}
```

- [ ] **Step 3: Verify TypeScript**

Run: `npm run typecheck -w server`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add server/src/repositories/baseRepository.ts
git commit -m "Add generic base repository for CRUD operations"
```

---

### Task 2: Trip Repository

**Files:**
- Create: `server/src/repositories/tripRepository.ts`

**Interfaces:**
- Consumes: `BaseRepository<T>` from Task 1, `Trip` type from `server/src/types.ts`.
- Produces: `TripRepository` class extending `BaseRepository<Trip>`.

- [ ] **Step 1: Write trip repository**

Create `server/src/repositories/tripRepository.ts`:

```ts
import type { Trip } from '../types.js'
import { BaseRepository } from './baseRepository.js'

export class TripRepository extends BaseRepository<Trip> {
  // Inherits all CRUD from BaseRepository
  // Future: add Trip-specific queries like getAllActive(), getByStatus(), etc.
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npm run typecheck -w server`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/repositories/tripRepository.ts
git commit -m "Add trip repository extending base repository"
```

---

### Task 3: Trip Service

**Files:**
- Create: `server/src/services/tripService.ts`

**Interfaces:**
- Consumes: `TripRepository` from Task 2, `Trip` and `Participant` types, domain utilities (`geo.ts`, `events.ts`, `fallback.ts`), Socket.io `Server`.
- Produces: `TripService` class with methods: `createTrip()`, `joinTrip()`, `handleAction()`, `getTripById()`, `getAllTrips()`.

- [ ] **Step 1: Create services directory**

Run: `mkdir -p server/src/services`
Expected: directory created.

- [ ] **Step 2: Write trip service**

Create `server/src/services/tripService.ts` with exact content (extract from spec's "Service Layer" section):

```ts
import type { Server } from 'socket.io'
import type { Trip, Participant } from '../types.js'
import type { TripRepository } from '../repositories/tripRepository.js'
import { point } from '../domain/geo.js'
import { addEvent, publicTrip, emitState } from '../domain/events.js'
import { activateFallback } from '../domain/fallback.js'
import { randomUUID } from 'node:crypto'

const now = () => new Date().toISOString()
const route = [
  point(19.076, 72.8777),
  point(19.082, 72.889),
  point(19.092, 72.897),
  point(19.103, 72.906),
  point(19.115, 72.916),
  point(19.125, 72.925),
]

export class TripService {
  constructor(private tripRepository: TripRepository, private io: Server) {}

  // Business logic: create a new trip
  createTrip(input: { name?: string; origin?: string; destination?: string; demoMode?: boolean }): Trip {
    const id = randomUUID()
    const created = now()
    const driver: Participant = {
      id: randomUUID(),
      name: 'Aarav (driver)',
      role: 'driver',
      location: route[0],
      lastSeen: created,
      online: true,
      updates: 1,
    }
    const trip: Trip = {
      id,
      shortId: id.slice(0, 6).toUpperCase(),
      name: input.name || 'Mumbai morning shuttle',
      origin: input.origin || 'Bandra West',
      destination: input.destination || 'Powai Lake',
      route,
      status: 'active',
      currentLocation: route[0],
      trackingSource: 'driver',
      driver,
      passengers: [],
      createdAt: created,
      events: [],
      demoMode: Boolean(input.demoMode),
    }
    addEvent(trip, 'trip', 'Trip generated', `${trip.origin} → ${trip.destination}`)
    
    // Demo mode: add sample passengers
    if (trip.demoMode) {
      ;['Meera', 'Kabir', 'Nisha'].forEach((name, index) => {
        const passenger: Participant = {
          id: randomUUID(),
          name,
          role: 'passenger',
          location: point(route[0].lat + index * 0.0002, route[0].lng + index * 0.0002),
          lastSeen: created,
          online: true,
          updates: trip.demoMode ? 2 : 1,
        }
        trip.passengers.push(passenger)
        addEvent(trip, 'join', `${name} joined`, 'Demo passenger connected to this trip')
      })
      addEvent(trip, 'system', 'Demo mode ready', 'Simulated people and driver are ready to move')
    }

    this.tripRepository.create(trip)
    emitState(this.io, this.tripRepository)
    return trip
  }

  // Business logic: join a trip
  joinTrip(tripId: string, input: { name?: string; role: 'driver' | 'passenger' }): Trip | null {
    const trip = this.tripRepository.getById(tripId)
    if (!trip) return null

    if (input.role === 'driver') {
      trip.driver.online = true
      trip.driver.name = input.name || trip.driver.name
    } else {
      const passenger: Participant = {
        id: randomUUID(),
        name: input.name || `Passenger ${trip.passengers.length + 1}`,
        role: 'passenger',
        location: trip.route[0],
        lastSeen: now(),
        online: true,
        updates: 1,
      }
      trip.passengers.push(passenger)
      addEvent(trip, 'join', `${passenger.name} joined`, 'Passenger check-in received')
    }

    this.tripRepository.save(trip)
    emitState(this.io, this.tripRepository)
    return trip
  }

  // Business logic: handle trip actions (fail, restore, validate, end, move)
  handleAction(tripId: string, action: string): Trip | null {
    const trip = this.tripRepository.getById(tripId)
    if (!trip) return null

    if (action === 'fail') {
      trip.lostDriverLocation = { ...trip.driver.location }
      trip.status = 'grace'
      trip.failureAt = now()
      trip.driver.online = false
      addEvent(trip, 'alert', 'Driver signal lost', 'Grace period started · looking for the driver')
      this.tripRepository.save(trip)
      emitState(this.io, this.tripRepository)
      setTimeout(() => activateFallback(trip, this.io), 6000)
    } else if (action === 'restore') {
      if (trip.status !== 'grace' && trip.status !== 'fallback') return null
      trip.status = 'restored'
      trip.driver.online = true
      trip.driver.lastSeen = now()
      trip.currentLocation = trip.driver.location
      trip.trackingSource = 'driver'
      delete trip.lostDriverLocation
      addEvent(trip, 'validation', 'Driver restored', 'Signal recovered; trip continues normally')
    } else if (action === 'validate') {
      activateFallback(trip, this.io)
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
      if (trip.status !== 'fallback') {
        trip.passengers.forEach((p) => {
          p.location = point(trip.route[next].lat + 0.0006, trip.route[next].lng + 0.0006)
          p.lastSeen = now()
          p.updates += 1
        })
      }
      addEvent(trip, 'location', 'Location ping', 'Simulated driver and passenger locations updated')
    }

    this.tripRepository.save(trip)
    emitState(this.io, this.tripRepository)
    return trip
  }

  // Queries
  getTripById(id: string): Trip | undefined {
    return this.tripRepository.getById(id)
  }

  getAllTrips(): Trip[] {
    return this.tripRepository.getAll()
  }
}
```

- [ ] **Step 3: Verify TypeScript**

Run: `npm run typecheck -w server`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add server/src/services/tripService.ts
git commit -m "Add trip service with all business logic"
```

---

### Task 4: Refactor Routes to Use Service

**Files:**
- Modify: `server/src/routes/trips.ts`

**Interfaces:**
- Consumes: `TripService` (injected as parameter to `createTripsRouter`), `publicTrip` from domain/events.
- Produces: Route handlers that call service methods and return JSON.

- [ ] **Step 1: Rewrite routes/trips.ts**

Replace entire file with:

```ts
import { Router } from 'express'
import type { TripService } from '../services/tripService.js'
import { publicTrip } from '../domain/events.js'

export function createTripsRouter(tripService: TripService) {
  const router = Router()

  // Health check
  router.get('/health', (_req, res) => {
    res.json({ ok: true })
  })

  // Get all trips
  router.get('/state', (_req, res) => {
    const trips = tripService.getAllTrips()
    res.json({ trips: trips.map(publicTrip) })
  })

  // Create a new trip
  router.post('/trips', (req, res) => {
    const trip = tripService.createTrip(req.body || {})
    res.status(201).json({ trip: publicTrip(trip) })
  })

  // Join a trip
  router.post('/trips/:id/join', (req, res) => {
    const trip = tripService.joinTrip(req.params.id, {
      name: req.body?.name,
      role: req.body?.role === 'driver' ? 'driver' : 'passenger',
    })
    if (!trip) return res.status(404).json({ error: 'Trip not found' })
    res.json({ trip: publicTrip(trip) })
  })

  // Handle trip actions
  router.post('/trips/:id/action', (req, res) => {
    const trip = tripService.handleAction(req.params.id, req.body?.action)
    if (!trip) {
      if (req.body?.action === 'restore' && tripService.getTripById(req.params.id)?.status === 'active') {
        return res.status(409).json({ error: 'Driver is already connected' })
      }
      return res.status(404).json({ error: 'Trip not found' })
    }
    res.json({ trip: publicTrip(trip) })
  })

  return router
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npm run typecheck -w server`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/trips.ts
git commit -m "Refactor routes to use injected trip service"
```

---

### Task 5: Update app.ts to Wire Dependencies

**Files:**
- Modify: `server/src/app.ts`

**Interfaces:**
- Consumes: `TripRepository`, `TripService`, `createTripsRouter`.
- Produces: Express app + references to repository and service (for socket setup).

- [ ] **Step 1: Rewrite app.ts**

Replace entire file with:

```ts
import express from 'express'
import cors from 'cors'
import type { Server } from 'socket.io'
import { TripRepository } from './repositories/tripRepository.js'
import { TripService } from './services/tripService.js'
import { createTripsRouter } from './routes/trips.js'
import { errorHandler } from './middleware/errorHandler.js'
import { config } from './config.js'

export function createApp(io: Server) {
  const app = express()

  // Instantiate repository and service
  const tripRepository = new TripRepository()
  const tripService = new TripService(tripRepository, io)

  // Middleware
  app.use(cors({ origin: config.corsOrigin }))
  app.use(express.json())

  // Routes (inject service)
  app.use('/api', createTripsRouter(tripService))

  // Error handler
  app.use(errorHandler)

  // Return app with references for socket setup
  return { app, tripRepository, tripService }
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npm run typecheck -w server`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/app.ts
git commit -m "Wire repository and service in app.ts"
```

---

### Task 6: Update index.ts for Socket Setup

**Files:**
- Modify: `server/src/index.ts`

**Interfaces:**
- Consumes: `TripRepository` from `app.ts` return value, `registerSocketHandlers` from sockets.
- Produces: HTTP server listening with services and sockets wired.

- [ ] **Step 1: Rewrite index.ts**

Replace entire file with:

```ts
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { createApp } from './app.js'
import { registerSocketHandlers } from './sockets/index.js'
import { config } from './config.js'

const httpServer = createServer()
const io = new Server(httpServer, { cors: { origin: config.corsOrigin } })

const { app, tripRepository, tripService } = createApp(io)
httpServer.on('request', app)

// Register socket handlers with repository
registerSocketHandlers(io, tripRepository)

httpServer.listen(config.port, () => {
  console.log(`Safar Setu API listening on http://localhost:${config.port}`)
})
```

- [ ] **Step 2: Verify TypeScript**

Run: `npm run typecheck -w server`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/index.ts
git commit -m "Update entrypoint to wire services and sockets"
```

---

### Task 7: Update Socket Handlers

**Files:**
- Modify: `server/src/sockets/index.ts`

**Interfaces:**
- Consumes: `TripRepository` injected as parameter.
- Produces: Socket handlers that read from repository directly.

- [ ] **Step 1: Rewrite sockets/index.ts**

Replace entire file with:

```ts
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
```

- [ ] **Step 2: Verify TypeScript**

Run: `npm run typecheck -w server`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/sockets/index.ts
git commit -m "Update socket handlers to receive and use trip repository"
```

---

### Task 8: Build, Lint, and Verify

**Files:**
- No new files. Verification only.

**Interfaces:**
- Consumes: All files from Tasks 1-7.

- [ ] **Step 1: Full build**

Run: `npm run build -w server`
Expected: `server/dist/` produced, no errors.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck -w server`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint -w server`
Expected: no errors.

- [ ] **Step 4: Dev boot and manual E2E test**

Run: `npm run dev -w server` in one terminal.
In another terminal (or in browser):
```bash
curl http://localhost:4000/api/health
```
Expected: `{"ok":true}`.

Then start the full dev stack:
```bash
npm run dev
```
Open `http://localhost:5173` in browser:
1. Click "Try the live demo"
2. Verify Landing → Driver console renders
3. Click "Simulate signal loss"
4. Verify status changes to "Grace period"
5. Click "Send location ping" or "Validate passenger cluster"
6. Verify trip status updates to "Passenger-assisted"
7. Click "Restore my signal"
8. Verify status returns to "Driver restored"
9. No console errors in browser devtools

Stop dev servers.

- [ ] **Step 5: Commit**

```bash
git add package-lock.json
git commit -m "Verify business logic layer implementation (all builds/lint pass, E2E test green)"
```

---

## Summary

All tasks implement the three-layer architecture:
1. **Repository** (Task 1-2): Generic base + trip repository for CRUD
2. **Service** (Task 3): All business logic, event coordination
3. **Controller** (Task 4): Thin REST handlers
4. **Wiring** (Task 5-7): Dependency injection in app/index/sockets
5. **Verification** (Task 8): Build, lint, E2E test

Final state: Business logic centralized, controllers thin, repository is single source of truth, socket handlers independent.
