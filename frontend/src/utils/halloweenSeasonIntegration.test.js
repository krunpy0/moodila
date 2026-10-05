import test from 'node:test'
import assert from 'node:assert/strict'
import { isHalloweenSeasonAvailable } from './halloweenSeason.js'

test('ThemeContext integration simulation - Halloween disabled on Nov 5 even if saved in storage', () => {
  // Simulate mock date on Nov 5th
  const testDate = new Date(2026, 10, 5, 10, 0, 0)
  const isAvailable = isHalloweenSeasonAvailable(testDate)
  assert.equal(isAvailable, false)

  // Simulate what ThemeContext does:
  const storedHalloweenInLocalStorage = 'true'
  const computedIsHalloween = isAvailable && storedHalloweenInLocalStorage === 'true'

  // Must be false!
  assert.equal(computedIsHalloween, false)

  // Selector visibility condition in Profile & DesktopSidebar:
  const showSelectorInProfile = isAvailable
  const showButtonInSidebar = isAvailable

  assert.equal(showSelectorInProfile, false)
  assert.equal(showButtonInSidebar, false)
})

test('ThemeContext integration simulation - Halloween enabled on Oct 31 with saved preference', () => {
  const testDate = new Date(2026, 9, 31, 20, 0, 0)
  const isAvailable = isHalloweenSeasonAvailable(testDate)
  assert.equal(isAvailable, true)

  const storedHalloweenInLocalStorage = 'true'
  const computedIsHalloween = isAvailable && storedHalloweenInLocalStorage === 'true'

  assert.equal(computedIsHalloween, true)

  const showSelectorInProfile = isAvailable
  const showButtonInSidebar = isAvailable

  assert.equal(showSelectorInProfile, true)
  assert.equal(showButtonInSidebar, true)
})
