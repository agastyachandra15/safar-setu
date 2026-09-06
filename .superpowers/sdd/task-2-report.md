# Task 2: Server workspace — scaffold + module split

## Status: DONE_WITH_CONCERNS

## Files created

- `server/package.json`
- `server/tsconfig.json`
- `server/eslint.config.js`
- `server/src/types.ts`
- `server/src/config.ts`
- `server/src/state/tripStore.ts`
- `server/src/domain/geo.ts`
- `server/src/domain/events.ts`
- `server/src/domain/fallback.ts`
- `server/src/routes/trips.ts`
- `server/src/sockets/index.ts`
- `server/src/middleware/errorHandler.ts`
- `server/src/app.ts`
- `server/src/index.ts`

## Files deleted

- `server/index.ts` (old flat entrypoint)
- `tsconfig.server.json` (root)
- `dist-server/` (old build output dir; was tracked at `dist-server/server/index.js`, removed via `git rm -rf`)

## Root changes

- `package.json`: added `"globals": "^15.14.0"` to `devDependencies` (required by `server/eslint.config.js`, which imports `globals` for `globals.node`).
- `package-lock.json`: updated by `npm install`.

## Build / verification output

- `npm install`: succeeded — "added 101 packages, changed 1 package, and audited 231 packages" (3 moderate audit vulnerabilities pre-existing/unrelated, not addressed here).
- `npm run build -w server`: succeeded (tsc compiled cleanly, no errors).
- `npm run typecheck -w server`: succeeded (`tsc --noEmit`, no errors).
- `npm run lint -w server`: succeeded after one deviation (see Concerns below).
- Manual test (`npm run dev -w server`, then curl):
  - `curl http://localhost:4000/api/health` → `{"ok":true}`
  - `curl http://localhost:4000/api/state` → `{"trips":[]}`

## Concerns

- The verbatim `server/src/middleware/errorHandler.ts` code block has an unused `_next: NextFunction` parameter (required by Express to recognize the 4-arg error-handler signature). ESLint's `@typescript-eslint/no-unused-vars` (via the root recommended config, which has no `argsIgnorePattern` exception for underscore-prefixed args) flagged this as an error, failing `npm run lint -w server`. To satisfy the task's lint-verification gate (step 5) without changing the function signature or behavior, I added a single `// eslint-disable-next-line @typescript-eslint/no-unused-vars` comment directly above the function declaration. This is the only deviation from the verbatim code blocks provided in the task.
- Wire contract was spot-checked (`/api/health`, `/api/state`) but `POST /api/trips`, `/join`, `/action`, and the socket `state`/`join-trip` events were not independently exercised beyond code review — they are verbatim ports of the original logic, so behavior should be identical, but full manual verification is deferred to Task 4 as specified.
- `.superpowers/` and `docs/superpowers/plans/` untracked directories exist in the working tree from prior/adjacent work; they were left untouched as out of scope for this task.

## Commit

`3b7b9c8` — "Scaffold server workspace and split monolithic index.ts into modules"
