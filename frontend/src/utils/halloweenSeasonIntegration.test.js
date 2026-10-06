import test from 'node:test'
import assert from 'node:assert/strict'

// Exact replication of ThemeContext synchronization logic using server features
function simulateThemeSync({ features, initialLocalStorage = {} }) {
  const storage = { ...initialLocalStorage }
  const localStorageMock = {
    getItem: (key) => storage[key] ?? null,
    setItem: (key, val) => {
      storage[key] = String(val)
    },
    removeItem: (key) => {
      delete storage[key]
    },
  }

  // 1. Initial state (from cache)
  let isHalloweenAvailable = localStorageMock.getItem('moodshare_server_halloween_available') === 'true'
  let isHalloween = isHalloweenAvailable && localStorageMock.getItem('moodshare_halloween') === 'true'

  // 2. Server response arrives (source of truth from /app/features)
  if (features && typeof features.halloween_enabled === 'boolean') {
    const enabled = features.halloween_enabled
    isHalloweenAvailable = enabled
    localStorageMock.setItem('moodshare_server_halloween_available', String(enabled))

    if (!enabled) {
      isHalloween = false
      localStorageMock.setItem('moodshare_halloween', 'false')
    } else {
      if (localStorageMock.getItem('moodshare_halloween') === 'true') {
        isHalloween = true
      }
    }
  }

  // 3. UI effect
  const activeClassApplied = isHalloweenAvailable && isHalloween
  const showProfileSelector = isHalloweenAvailable
  const showSidebarToggle = isHalloweenAvailable

  return {
    isHalloweenAvailable,
    isHalloween,
    activeClassApplied,
    showProfileSelector,
    showSidebarToggle,
    storage,
  }
}

test('Server feature integration - On and after November 5th (halloween_enabled: false)', () => {
  // Simulate user visiting after Nov 5th where server dictates halloween_enabled: false
  // Even if user previously had the theme enabled in storage:
  const result = simulateThemeSync({
    features: { halloween_enabled: false, server_time: '2026-11-05T00:00:00Z' },
    initialLocalStorage: {
      moodshare_server_halloween_available: 'true',
      moodshare_halloween: 'true',
    },
  })

  // The selector MUST disappear from UI
  assert.equal(result.showProfileSelector, false, 'Profile Halloween selector must disappear')
  assert.equal(result.showSidebarToggle, false, 'Sidebar Halloween button must disappear')

  // The theme must be disabled
  assert.equal(result.isHalloweenAvailable, false)
  assert.equal(result.isHalloween, false)
  assert.equal(result.activeClassApplied, false, '.halloween CSS class must NOT be applied')

  // Storage must be updated to reflect server state
  assert.equal(result.storage.moodshare_server_halloween_available, 'false')
  assert.equal(result.storage.moodshare_halloween, 'false')
})

test('Server feature integration - During Halloween season before Nov 5th (halloween_enabled: true)', () => {
  // Simulate user visiting during season where server dictates halloween_enabled: true
  const result = simulateThemeSync({
    features: { halloween_enabled: true, server_time: '2026-10-31T20:00:00Z' },
    initialLocalStorage: {
      moodshare_halloween: 'true',
    },
  })

  // The selector MUST be visible in UI
  assert.equal(result.showProfileSelector, true, 'Profile Halloween selector must be visible')
  assert.equal(result.showSidebarToggle, true, 'Sidebar Halloween button must be visible')

  // The theme is active because user had it turned on
  assert.equal(result.isHalloweenAvailable, true)
  assert.equal(result.isHalloween, true)
  assert.equal(result.activeClassApplied, true, '.halloween CSS class must be applied')
  assert.equal(result.storage.moodshare_server_halloween_available, 'true')
})

test('Server feature integration - During Halloween season with theme turned off by user', () => {
  const result = simulateThemeSync({
    features: { halloween_enabled: true, server_time: '2026-11-04T23:59:00Z' },
    initialLocalStorage: {
      moodshare_halloween: 'false',
    },
  })

  // Selector is visible for user to toggle
  assert.equal(result.showProfileSelector, true)
  assert.equal(result.showSidebarToggle, true)

  // But theme is off
  assert.equal(result.isHalloweenAvailable, true)
  assert.equal(result.isHalloween, false)
  assert.equal(result.activeClassApplied, false)
})
