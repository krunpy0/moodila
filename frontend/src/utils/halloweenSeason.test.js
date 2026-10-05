import test from 'node:test'
import assert from 'node:assert/strict'
import { isHalloweenSeasonAvailable } from './halloweenSeason.js'

test('Halloween Season - October is always available', () => {
  // Beginning of October
  assert.equal(isHalloweenSeasonAvailable(new Date(2026, 9, 1, 0, 0, 0)), true)
  // Mid-October
  assert.equal(isHalloweenSeasonAvailable(new Date(2026, 9, 15, 12, 0, 0)), true)
  // Halloween night (Oct 31)
  assert.equal(isHalloweenSeasonAvailable(new Date(2026, 9, 31, 23, 59, 59)), true)
})

test('Halloween Season - November 1 to November 4 is available', () => {
  assert.equal(isHalloweenSeasonAvailable(new Date(2026, 10, 1, 0, 0, 0)), true)
  assert.equal(isHalloweenSeasonAvailable(new Date(2026, 10, 2, 14, 30, 0)), true)
  assert.equal(isHalloweenSeasonAvailable(new Date(2026, 10, 3, 18, 0, 0)), true)
  // Final minute before November 5th
  assert.equal(isHalloweenSeasonAvailable(new Date(2026, 10, 4, 23, 59, 59)), true)
})

test('Halloween Season - November 5th boundary: disappears at 00:00:00 on Nov 5th', () => {
  // Midnight start of November 5th
  assert.equal(isHalloweenSeasonAvailable(new Date(2026, 10, 5, 0, 0, 0)), false)
  // Midday November 5th
  assert.equal(isHalloweenSeasonAvailable(new Date(2026, 10, 5, 12, 0, 0)), false)
  // End of November 5th
  assert.equal(isHalloweenSeasonAvailable(new Date(2026, 10, 5, 23, 59, 59)), false)
})

test('Halloween Season - Dates after November 5th are unavailable', () => {
  assert.equal(isHalloweenSeasonAvailable(new Date(2026, 10, 6, 0, 0, 0)), false)
  assert.equal(isHalloweenSeasonAvailable(new Date(2026, 10, 10, 12, 0, 0)), false)
  assert.equal(isHalloweenSeasonAvailable(new Date(2026, 10, 30, 23, 59, 59)), false)
})

test('Halloween Season - Other months are unavailable', () => {
  // December
  assert.equal(isHalloweenSeasonAvailable(new Date(2026, 11, 25, 12, 0, 0)), false)
  // January
  assert.equal(isHalloweenSeasonAvailable(new Date(2027, 0, 1, 0, 0, 0)), false)
  // June
  assert.equal(isHalloweenSeasonAvailable(new Date(2026, 5, 15, 12, 0, 0)), false)
  // September 30 (just before October)
  assert.equal(isHalloweenSeasonAvailable(new Date(2026, 8, 30, 23, 59, 59)), false)
})

test('Halloween Season - Multi-year recurrence works correctly', () => {
  assert.equal(isHalloweenSeasonAvailable(new Date(2027, 9, 31)), true)
  assert.equal(isHalloweenSeasonAvailable(new Date(2027, 10, 4, 23, 59, 59)), true)
  assert.equal(isHalloweenSeasonAvailable(new Date(2027, 10, 5, 0, 0, 0)), false)

  assert.equal(isHalloweenSeasonAvailable(new Date(2028, 9, 31)), true)
  assert.equal(isHalloweenSeasonAvailable(new Date(2028, 10, 4)), true)
  assert.equal(isHalloweenSeasonAvailable(new Date(2028, 10, 5)), false)
})

test('Halloween Season - Accepts ISO string inputs', () => {
  assert.equal(isHalloweenSeasonAvailable('2026-10-31T20:00:00'), true)
  assert.equal(isHalloweenSeasonAvailable('2026-11-04T23:59:59'), true)
  assert.equal(isHalloweenSeasonAvailable('2026-11-05T00:00:00'), false)
  assert.equal(isHalloweenSeasonAvailable('2026-11-06T10:00:00'), false)
})

test('Halloween Season - Mock date override via window.__MOODILA_MOCK_DATE__', () => {
  globalThis.window = { __MOODILA_MOCK_DATE__: '2026-11-05T08:00:00' }
  assert.equal(isHalloweenSeasonAvailable(), false)

  globalThis.window.__MOODILA_MOCK_DATE__ = '2026-10-31T23:00:00'
  assert.equal(isHalloweenSeasonAvailable(), true)

  delete globalThis.window
})
