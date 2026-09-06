# E2E Testing Guide for Safar Setu

## Overview

The Playwright E2E test suite validates the complete demo mode functionality with focus on the fallback route progression fix.

**Test coverage:**
- Demo trip creation with 14-waypoint route
- Route progression in active state (monotonic)
- Fallback activation with grace period
- **Critical:** Route progression in fallback (should move forward, not backward)
- Driver restoration and recovery
- Trip completion

## Running Tests

### Prerequisites

Install Playwright browsers (one-time):
```bash
npx playwright install
```

### Run Full Test Suite

```bash
npm run test:e2e
```

Runs all 8 tests serially using Playwright. The dev server starts automatically.

### Run Specific Test

```bash
npx playwright test tests/e2e.spec.ts -g "fallback move progresses"
```

### View Test Report

After running tests:
```bash
npx playwright show-report
```

Opens an HTML report with test results and traces.

## Key Test: Fallback Route Progression

**Test:** `fallback move progresses route forward (KEY TEST)`

This test validates the critical bug fix:
- Before fix: routeIndex would reset to 1 or stay frozen during fallback pings
- After fix: routeIndex progresses monotonically forward

Test steps:
1. Create demo trip (14 waypoints, routeIndex=0)
2. Move 3 times in active state → routeIndex becomes 3
3. Trigger signal loss → status='grace', routeIndex stays 3
4. Wait 6+ seconds → status='fallback', centroid calculated
5. **Move in fallback** → routeIndex becomes 4 ✓
6. **Move again** → routeIndex becomes 5 ✓
7. Verify no reset/backward movement

## Demo Route (14 waypoints)

Mumbai journey from Bandra West to Dadar:
- Route[0]: Bandra West (start)
- Route[1-5]: Bandra → Grant Road → Girgaum
- Route[6-9]: Malabar Hill → Breach Candy → Tardeo
- Route[10-13]: Worli → Lower Parel → Prabhadevi → Dadar (end)

## Performance Notes

- Full suite runs in ~25 seconds (includes 6+ second grace period wait)
- Fallback test waits 7 seconds for grace period + activation
- Single-worker serial execution ensures state consistency

## Debugging Failed Tests

### Check API is running

```bash
curl http://localhost:4000/api/health
```

### Enable trace recording

Playwright automatically records traces on first retry.

View trace:
```bash
npx playwright show-report
```

### Inspect test state

Add console logs in test to verify trip state:
```typescript
const data = await api('/api/state')
const trip = data.trips.find(t => t.id === tripId)
console.log('Trip state:', { routeIndex: trip.routeIndex, status: trip.status })
```

## Continuous Integration

For CI/CD pipelines:
```bash
CI=true npm run test:e2e
```

The Playwright config (`playwright.config.ts`) is set up with:
- Single worker for CI (serial execution)
- Retries: 2 for CI, 0 for local
- Trace recording on first retry
- HTML report generation

## Extending Tests

To add new tests:

```typescript
test('new test case', async () => {
  const data = await api('/api/trips', {
    method: 'POST',
    body: JSON.stringify({ demoMode: true }),
  })
  const tripId = data.trip.id
  
  // Your test logic here
  expect(data.trip.routeIndex).toBe(0)
})
```

Add to the `test.describe.serial()` block to maintain serial execution and shared state.

## Related Files

- `playwright.config.ts` — Playwright configuration
- `tests/e2e.spec.ts` — Test suite
- `server/src/services/tripService.ts` — Move action implementation (line ~139)
- `server/src/types.ts` — Trip type with routeIndex field
