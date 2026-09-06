# Safar Setu: Monorepo Split (server / frontend)

## Goal

Split the current flat repo (root-level `src/` for the client, `server/`
for the Express+Socket.io API, sharing one root `package.json`) into an
npm-workspaces monorepo with two independent packages — `server/` and
`frontend/` — each with production-grade internal structure, while
keeping a single command to run both in development.

## Non-goals

- No shared types package. Server and frontend keep independent type
  definitions; they only agree on the JSON shape over HTTP/WS.
- No behavior changes. Trip lifecycle logic, REST contract, socket
  events, and UI markup/CSS stay identical — this is a structural
  refactor plus tooling addition, not a feature change.
- No test suite is being added (none exists today); `tsc --noEmit` /
  build remains the verification mechanism.

## Repo layout

```
/ (root)
  package.json            -- private, workspaces: ["server","frontend"]
                              root scripts: dev/build/lint/format fan out via -w or --workspaces
  package-lock.json
  .eslintrc.json           -- shared base config, extended by each workspace
  .prettierrc
  .gitignore
  DEMO_GUIDE.txt
  docs/

  server/
    package.json           -- own deps: express, cors, socket.io; devDeps: types, tsx, typescript, eslint
    tsconfig.json
    eslint.config.js        -- extends root, adds @typescript-eslint
    src/
      index.ts              -- entrypoint: build app+http server, listen on PORT
      app.ts                 -- express() instance, cors/json middleware, mounts routes, mounts errorHandler
      config.ts              -- reads PORT, CORS_ORIGIN from process.env with defaults
      types.ts                -- Role, TripStatus, EventKind, Point, Participant, TripEvent, Trip
      state/
        tripStore.ts          -- trips Map, createTrip(), getTrip(), the seed `route`
      domain/
        geo.ts                 -- point(), distanceMeters()
        events.ts              -- addEvent(), publicTrip(), emitState() (takes io)
        fallback.ts             -- activateFallback(trip, io) cluster/centroid logic
      routes/
        trips.ts               -- express.Router: health, state, create, join, action
      sockets/
        index.ts                -- registerSocketHandlers(io)
      middleware/
        errorHandler.ts          -- catches thrown/async errors, consistent {error} JSON + status

  frontend/
    package.json            -- own deps: react, react-dom, leaflet, socket.io-client; devDeps: vite, @vitejs/plugin-react, types, eslint
    tsconfig.json
    vite.config.ts           -- moved as-is (port 5173, proxy /api and /socket.io -> localhost:4000)
    index.html                -- moved as-is
    eslint.config.js          -- extends root, adds react-hooks/react-refresh plugins
    src/
      main.tsx, styles.css     -- moved as-is
      types.ts                  -- Role, Status, Point, Person, Event, Trip (client's own copy)
      lib/
        api.ts                   -- api() fetch wrapper
      hooks/
        useTrips.ts               -- socket connection + /api/state polling, exposes {trips, error, refresh, setTrips}
      utils/
        time.ts                    -- timeAgo()
      components/
        MapView.tsx, Badge.tsx, JoinBox.tsx, EventLog.tsx, Empty.tsx, TripHeader.tsx
      pages/
        Landing.tsx, Driver.tsx, Passenger.tsx, Relative.tsx, Admin.tsx
      App.tsx                     -- shell: topbar, sidebar nav, role switch, wires useTrips + action/create/join callbacks into pages
```

`dist-server/` (server build output) and any `dist/` (frontend build
output) stay gitignored at their respective workspace roots.

## Root orchestration

Root `package.json`:

```jsonc
{
  "name": "safar-setu",
  "private": true,
  "workspaces": ["server", "frontend"],
  "scripts": {
    "dev": "concurrently -n server,frontend -c blue,green \"npm run dev -w server\" \"npm run dev -w frontend\"",
    "build": "npm run build -w server && npm run build -w frontend",
    "lint": "npm run lint -w server && npm run lint -w frontend",
    "format": "prettier --write .",
    "test": "npm run typecheck -w server && npm run typecheck -w frontend"
  },
  "devDependencies": {
    "concurrently": "^9.1.2",
    "prettier": "^3.x",
    "eslint": "^9.x",
    "typescript": "^5.7.2"
  }
}
```

`server/package.json` scripts: `dev` (tsx watch src/index.ts), `build`
(tsc), `start` (node dist/index.js), `lint`, `typecheck`.
`frontend/package.json` scripts: `dev` (vite), `build` (vite build),
`preview`, `lint`, `typecheck` (tsc --noEmit).

npm workspaces hoist shared deps (typescript, eslint, @types/node) to
the root `node_modules`; each workspace's own runtime deps
(express/cors/socket.io for server; react/leaflet/socket.io-client for
frontend) live declared in that workspace's package.json.

## Server refactor detail

Pure move-and-split, no logic changes:
- `types.ts` — the type block at the top of current `server/index.ts`.
- `state/tripStore.ts` — the `trips` Map, `route` seed data, `createTrip`.
- `domain/geo.ts` — `point()`, `distanceMeters()`, currently defined
  inline in `server/index.ts`.
- `domain/events.ts` — `addEvent()`, `publicTrip()`, `emitState()`.
- `domain/fallback.ts` — `activateFallback()`.
- `routes/trips.ts` — the five `app.get`/`app.post` handlers, converted
  to `express.Router()`, exported and mounted in `app.ts` under `/api`.
- `sockets/index.ts` — the `io.on('connection', ...)` block as
  `registerSocketHandlers(io)`.
- `app.ts` — builds the `express()` app, applies `cors()` +
  `express.json()`, mounts the trips router, mounts `errorHandler` last.
- `index.ts` — creates `httpServer`/`io`, calls `registerSocketHandlers`,
  reads `config.ts` for port, calls `httpServer.listen`.

`middleware/errorHandler.ts` is new behavior surface (not present
today): a standard 4-arg Express error middleware that logs the error
and responds `{ error: message }` with `err.status ?? 500` if a route
handler throws or calls `next(err)`. Existing routes' explicit
`res.status(404)/(409)` calls are unchanged; this only catches
previously-uncaught throws (e.g. malformed body causing a TypeError),
which currently would crash the request with a raw 500 HTML page.

## Frontend refactor detail

Pure move-and-split, no markup/behavior changes:
- `types.ts` — the type block at the top of current `App.tsx`.
- `lib/api.ts` — the `api()` helper.
- `utils/time.ts` — `timeAgo()`.
- `components/MapView.tsx`, `Badge.tsx`, `JoinBox.tsx`, `EventLog.tsx`,
  `Empty.tsx`, `TripHeader.tsx` — extracted as-is with their existing
  prop signatures.
- `pages/Landing.tsx`, `Driver.tsx`, `Passenger.tsx`, `Relative.tsx`,
  `Admin.tsx` — extracted as-is with their existing prop signatures.
- `hooks/useTrips.ts` — wraps the `refresh`/socket-effect logic
  currently inline in `App()`, returning `{ trips, setTrips, error,
  setError, refresh }`.
- `App.tsx` — retains `role`/`selected`/`name`/`tripCode` state, the
  `act`/`create`/`join` callbacks (now calling into `lib/api.ts`
  directly), the topbar/sidebar shell markup, and renders the
  extracted page components.

## Tooling

- Root `eslint.config.js` (flat config) with `@eslint/js` recommended +
  `typescript-eslint` recommended, shared parser options.
- `server/eslint.config.js` extends root, Node globals.
- `frontend/eslint.config.js` extends root, adds `eslint-plugin-react-hooks`
  and `eslint-plugin-react-refresh`, browser globals, JSX support.
- Root `.prettierrc` with `semi: false, singleQuote: true`, matching
  the existing no-semicolon single-quote style so formatting doesn't
  produce an unrelated reformat-everything diff.
- `errorHandler.ts` covered above is the only runtime behavior addition.

## Verification plan

1. `npm install` at root resolves workspaces correctly.
2. `npm run build` — both workspaces typecheck and build clean.
3. `npm run lint` — no errors on the moved code (warnings acceptable
   for pre-existing patterns like long JSX one-liners).
4. `npm run dev` — both dev servers start from one command; visiting
   `http://localhost:5173` loads the app, `/api/health` proxies
   correctly, demo flow (create trip → simulate signal loss → cluster
   validation → restore) still works end to end via manual click-through.
5. Old root `src/`, root `server/index.ts`, root `vite.config.ts`,
   `index.html`, `tsconfig*.json` are removed once the moved copies are
   verified working (git history preserves the originals).
