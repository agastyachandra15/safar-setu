# Business Logic Layer Separation: Repository-Service-Controller Pattern

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the server backend to separate business logic, API handling, and data persistence into distinct layers (repository, service, controller), improving testability, maintainability, and reusability.

**Architecture:** Three-layer pattern with dependency injection:
- **Repository layer:** Thin CRUD wrapper around the in-memory trips Map. No business logic.
- **Service layer:** Owns all business logic (trip creation, joining, actions, recovery rules) and coordinates state changes, events, and emissions.
- **Controller layer:** Thin REST handlers that receive requests, call service methods, return JSON responses.
- **Socket handlers:** Independent, call repository directly for reads to avoid service latency.

**Tech Stack:** TypeScript, Express (controllers), in-memory Map with repository abstraction, dependency injection via constructor.

**Spec:** This document. No separate design-doc prerequisite; this spec describes the full refactoring.

## Global Constraints

- No behavior changes — trip lifecycle logic, REST contract, socket events, and in-memory state remain identical.
- In-memory Map stays as the data source (no database migration).
- Existing domain utilities (`geo.ts`, `events.ts`, `fallback.ts`) are reused by the service layer; no refactoring of those modules.
- All business logic centralizes in `TripService`; domain utilities remain focused on calculations and utility functions.
- Socket handlers receive repository for direct reads (performance); all writes go through service.

---

## Repository Layer

**Purpose:** Single source of truth for data persistence. Provides CRUD operations, no business logic.

### Base Repository

**File:** `server/src/repositories/baseRepository.ts`

Generic abstract base class for all repositories. Implements standard CRUD operations on an in-memory Map.

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

### Trip Repository

**File:** `server/src/repositories/tripRepository.ts`

Extends `BaseRepository<Trip>`. Currently inherits all methods; can add Trip-specific queries in the future.

```ts
import type { Trip } from '../types.js'
import { BaseRepository } from './baseRepository.js'

export class TripRepository extends BaseRepository<Trip> {
  // Inherits all CRUD from BaseRepository
  // Future: add Trip-specific queries like getAllActive(), getByStatus(), etc.
}
```

---

## Service Layer

**Purpose:** Encapsulates all business logic. Coordinates state mutations, events, and side effects (socket emissions).

**File:** `server/src/services/tripService.ts`

The service:
- Receives `TripRepository` and Socket.io `Server` as constructor dependencies
- Implements all business operations: `createTrip()`, `joinTrip()`, `handleAction()`
- Calls domain utilities for calculations (`geo.ts`, `fallback.ts`, `events.ts`)
- Persists via repository, emits state via io
- Returns Trip objects (or null for errors); never throws HTTP errors

**Key methods:**

- `createTrip(input)` — Creates a new trip with optional demo mode, persists, emits state. Returns the trip.
- `joinTrip(tripId, {name, role})` — Adds driver or passenger to a trip. Returns trip or null if not found.
- `handleAction(tripId, action)` — Handles trip actions (fail, restore, validate, end, move). Returns trip or null.
- `getTripById(id)` — Query: retrieve a trip by ID.
- `getAllTrips()` — Query: retrieve all trips.

All state changes flow through these methods. All socket emissions happen here (via `emitState()`).

---

## Controller Layer

**Purpose:** HTTP request/response handling. Delegates all logic to the service.

**File:** `server/src/routes/trips.ts` (refactored)

The controller layer:
- Receives `TripService` as a constructor dependency
- Each route handler: extract request data → call service method → return JSON response
- Minimal logic; error handling is service's job (returns null for "not found," controller converts to HTTP status)

**Routes:**

- `GET /api/health` — Health check (no change)
- `GET /api/state` — List all trips
- `POST /api/trips` — Create a new trip
- `POST /api/trips/:id/join` — Join a trip (as driver or passenger)
- `POST /api/trips/:id/action` — Handle trip action (fail, restore, validate, end, move)

---

## Socket Handlers

**Purpose:** Real-time event handlers. Designed to bypass service for read efficiency.

**File:** `server/src/sockets/index.ts` (refactored)

Socket handlers:
- Receive `TripRepository` as dependency
- On connection: emit current state (read directly from repository)
- `join-trip` event: socket joins a trip's room

All socket state mutations still go through the service (which emits via `io.emit('state', ...)`). Handlers only read from repository directly.

---

## App Wiring

**File:** `server/src/app.ts` (updated)

Creates the Express app and instantiates the dependency graph:
1. Create `TripRepository` (singleton)
2. Create `TripService` with repository and io
3. Mount routes with service injected
4. Mount error handler
5. Return app, repository, and service references (for socket setup)

**File:** `server/src/index.ts` (updated)

Entrypoint:
1. Create HTTP server and Socket.io server
2. Call `createApp(io)` to get app, repository, service
3. Register socket handlers with repository
4. Listen on port

---

## Data Flow Examples

### Creating a Trip (REST)

```
POST /api/trips (controller)
  ↓
Controller.createTrip() calls TripService.createTrip()
  ↓
Service:
  - Creates Trip object with initial state
  - Adds initial event to trip.events
  - If demoMode: creates demo passengers
  - Calls TripRepository.create() to persist
  - Calls emitState(io, repository) to notify all clients
  - Returns trip
  ↓
Controller returns JSON: { trip: publicTrip(trip) }
```

### Driver Signal Loss → Recovery (REST + Sockets)

```
POST /api/trips/:id/action { action: "fail" } (controller)
  ↓
Service.handleAction("fail"):
  - Updates trip.status to 'grace'
  - Sets trip.driver.online = false
  - Saves to repository
  - Emits state (all connected clients notified)
  - Schedules activateFallback() after 6s (calls service again if needed)
  ↓
6 seconds later: activateFallback(trip, io) (domain logic)
  - Validates passenger cluster
  - If valid: updates trip.status to 'fallback', sets currentLocation to centroid
  - Calls emitState(io, repository) to notify clients
```

### Reading State (Socket)

```
Socket connects
  ↓
Handler reads: repository.getAll() (direct, no service call)
  ↓
Emits: socket.emit('state', { trips: all trips mapped via publicTrip() })
```

---

## Testing & Verification

- **Repository tests:** Mock storage, verify CRUD operations and queries
- **Service tests:** Mock repository and io, call service methods, verify state mutations and `io.emit()` calls
- **Controller tests:** Mock service, send HTTP requests, verify status codes and response bodies
- **Integration tests:** Spin up full app, verify REST ↔ service ↔ repository flow, socket emissions

Current task uses `tsc`/`npm run build`/`npm run lint` for verification. Future: add jest/vitest unit tests for each layer.

---

## Migration Path

1. Create `repositories/` and `services/` directories
2. Write `baseRepository.ts` and `tripRepository.ts`
3. Write `tripService.ts` with all business logic extracted from routes
4. Refactor `routes/trips.ts` to use injected service
5. Update `app.ts` to instantiate repository and service
6. Update `index.ts` to wire socket handlers with repository
7. Update `sockets/index.ts` to receive repository
8. Verify: build, lint, manual E2E test (dev boot + browser click-through)

---

## Success Criteria

- All business logic centralizes in `TripService` (no logic left in routes or socket handlers)
- Repository is the sole source of truth for trips data
- Controllers are thin (< 10 lines per route handler)
- Socket handlers read directly from repository without calling service
- All existing REST endpoints work identically (same request/response contract)
- All socket events (state emission) work identically
- Build, lint, typecheck pass
- Manual E2E test passes (demo flow works end-to-end)
