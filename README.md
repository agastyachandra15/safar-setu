# Safar Setu — Journey Assurance for Public Transit

Safar Setu demonstrates intelligent fallback tracking for public bus passengers. When a driver loses connection, the system verifies passengers from the same trip and uses their cluster location as an approximate fallback.

**Status:** Early prototype | **Node.js:** 18+ | **Package Manager:** npm

---

## Quick Start

### Prerequisites

- **Node.js** 18 or later
- **npm** (included with Node.js)
- An internet connection (for map tiles)

### 1. Install Dependencies

```bash
npm install
```

This installs dependencies for both the server and frontend workspaces.

### 2. Start Development

```bash
npm run dev
```

This starts both the server (port 4000) and frontend (port 5173) in parallel.

### 3. Open the App

Navigate to **http://localhost:5173** in your browser.

---

## Project Structure

```
safar-setu/
├── server/                          # Node.js / Express backend
│   ├── src/
│   │   ├── repositories/            # Data layer (CRUD operations)
│   │   ├── services/                # Business logic layer
│   │   ├── routes/                  # HTTP route handlers
│   │   ├── sockets/                 # Real-time WebSocket handlers
│   │   ├── types.ts                 # TypeScript types
│   │   ├── utils/                   # Domain utilities (geo, events, fallback)
│   │   └── index.ts                 # Server entry point
│   ├── dist/                        # Compiled JavaScript (npm run build)
│   └── package.json
│
├── frontend/                        # React / Vite frontend
│   ├── src/
│   │   ├── components/              # React components
│   │   ├── types/                   # TypeScript types
│   │   ├── App.tsx                  # Main app component
│   │   └── main.tsx                 # React entry point
│   ├── dist/                        # Built assets (npm run build)
│   └── package.json
│
├── docs/                            # Design docs and specifications
│   ├── superpowers/
│   │   ├── specs/                   # Architecture and design specs
│   │   └── plans/                   # Implementation plans
│   └── ...
│
├── package.json                     # Root monorepo configuration
├── package-lock.json
├── tsconfig.json                    # Shared TypeScript config
├── eslint.config.js                 # Linting rules
├── .prettierrc                       # Code formatting
└── DEMO_GUIDE.txt                   # Detailed demo walkthrough
```

---

## Available Scripts

**From the project root**, run commands with `-w` to target a workspace:

### Root Level (Both Workspaces)

```bash
npm run dev          # Start frontend and backend in parallel
npm run build        # Build both server and frontend
npm run lint         # Lint both workspaces
npm run format       # Format all code with Prettier
npm test             # Type-check both workspaces
```

### Server Only

```bash
npm run dev -w server       # Start server in watch mode (port 4000)
npm run build -w server     # Compile TypeScript to JavaScript
npm run start -w server     # Run compiled server (requires npm run build first)
npm run typecheck -w server # Type-check without emitting
npm run lint -w server      # Lint server code
```

### Frontend Only

```bash
npm run dev -w frontend     # Start Vite dev server (port 5173)
npm run build -w frontend   # Build production bundle
npm run preview -w frontend # Preview production build locally
npm run typecheck -w frontend # Type-check frontend code
npm run lint -w frontend    # Lint frontend code
```

---

## Architecture Overview

Safar Setu uses a **three-layer architecture pattern** for maintainability and testability:

### Layer 1: Repository (Data)

Thin CRUD wrapper around in-memory trips storage. No business logic.

- **File:** `server/src/repositories/`
- **Pattern:** Generic `BaseRepository<T>` with standard CRUD operations
- **Storage:** In-memory Map (no database)

### Layer 2: Service (Business Logic)

Owns all trip lifecycle logic: creation, joining, signal loss/recovery, passenger fallback.

- **File:** `server/src/services/tripService.ts`
- **Responsibilities:**
  - Trip creation and state management
  - Passenger joining and validation
  - Signal loss/recovery handling
  - Passenger fallback clustering
  - Socket.IO event emission

### Layer 3: Controller (HTTP)

Thin REST handlers that receive requests, delegate to service, return JSON.

- **File:** `server/src/routes/trips.ts`
- **Endpoints:**
  - `GET /api/health` — Health check
  - `GET /api/state` — List all trips
  - `POST /api/trips` — Create trip
  - `POST /api/trips/:id/join` — Join trip
  - `POST /api/trips/:id/action` — Handle trip action

### Socket.IO Handlers

Real-time event handlers that read directly from repository for performance.

- **File:** `server/src/sockets/index.ts`
- **Pattern:** Direct repository reads, writes go through service

---

## Running the Demo

### Quick Demo Flow (2–4 minutes)

1. **Start the app** (see Quick Start above)
2. **Driver View:** Click "Try the live demo"
   - Generates a trip with simulated driver and passengers
   - Shows map, markers, and event log
3. **Simulate Events:**
   - Click "Send location ping" → passengers move
   - Click "Simulate signal loss" → driver goes offline
   - Wait 6 seconds → system activates passenger fallback
   - Click "Restore my signal" → driver reconnects
   - Click "End trip" → trip completes
4. **Passenger View:** Enter trip ID and join as a passenger
5. **Admin View:** See all trips and recovery states

See **DEMO_GUIDE.txt** for a detailed walkthrough.

---

## Development Workflow

### Starting Work

```bash
git checkout -b feature/my-feature
npm run dev    # Start both server and frontend
```

The frontend reloads on file changes; the server reloads via `tsx watch`.

### Before Committing

```bash
npm run lint       # Check for linting issues
npm test           # Type-check both workspaces
npm run format     # Auto-format code
```

### Building for Production

```bash
npm run build      # Compiles both server and frontend
npm run start -w server    # Run the compiled server
```

---

## Key Concepts

### Trip States

| State | Meaning |
|-------|---------|
| **Driver live** | Driver location is the current tracking source |
| **Grace period** | Driver offline; system waiting before fallback |
| **Passenger-assisted** | Passenger cluster verified; centroid is fallback location |
| **Driver restored** | Driver reconnected; primary tracking restored |
| **Ended** | Trip completed; tracking stopped |

### Fallback Algorithm

When the driver goes offline:
1. Wait 6 seconds (grace period)
2. Find all passengers on the same trip
3. Check that they are close to last known driver location
4. Require at least 2 consistent passengers
5. Calculate centroid (average lat/lng)
6. Use centroid as fallback location

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, Leaflet (maps), Socket.IO client |
| **Backend** | Node.js, Express, TypeScript, Socket.IO server |
| **Data** | In-memory Map (prototype; no database) |
| **Build** | TypeScript, npm workspaces, ESLint, Prettier |

---

## Important Notes

- **No Database:** State is stored in memory. Restarting the server clears all trips.
- **Prototype:** This is a proof-of-concept. The fallback algorithm is not production-grade.
- **Map Tiles:** OpenStreetMap requires internet. Layout still works offline.
- **Passengers Isolation:** Fallback only uses passengers joined to the same trip ID.
- **Privacy:** Passenger views don't expose individual passenger locations.

---

## Troubleshooting

### Ports Already in Use

If port 4000 (server) or 5173 (frontend) are in use:
- Stop existing processes: `lsof -ti :4000 | xargs kill -9`
- Or edit `server/src/index.ts` and `frontend/vite.config.ts` to use different ports

### Map Not Loading

Ensure you have internet access for OpenStreetMap tiles. The app still functions without tiles.

### Changes Not Reloading

- **Frontend:** Should auto-reload via Vite HMR
- **Server:** Should auto-reload via `tsx watch`
- If not, stop and restart `npm run dev`

### Type Errors

```bash
npm test   # Run type-checker on both workspaces
npm run typecheck -w server    # Just server
npm run typecheck -w frontend  # Just frontend
```

---

## Contributing

1. Create a feature branch
2. Make changes and test: `npm run lint && npm test`
3. Push to your fork
4. Create a pull request against `main`

---

## Resources

- **Demo Guide:** See `DEMO_GUIDE.txt` for detailed feature walkthrough
- **Design Docs:** See `docs/superpowers/specs/` for architecture and design
- **Implementation Plans:** See `docs/superpowers/plans/` for task breakdowns

---

**Last Updated:** September 2026 | **Version:** 0.1.0 (Prototype)
