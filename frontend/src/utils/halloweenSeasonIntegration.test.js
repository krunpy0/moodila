import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getAvailableThemes,
  getFallbackTheme,
  isThemeAvailable,
} from './themes.js'

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
  let activeSeasonalThemes = []
  const cachedActive = localStorageMock.getItem('moodshare_active_seasonal_themes')
  if (cachedActive) {
    try {
      activeSeasonalThemes = JSON.parse(cachedActive)
    } catch {}
  } else if (localStorageMock.getItem('moodshare_server_halloween_available') === 'true') {
    activeSeasonalThemes = ['halloween']
  }

  let isHalloweenAvailable = activeSeasonalThemes.includes('halloween')
  let isHalloween = isHalloweenAvailable && localStorageMock.getItem('moodshare_halloween') === 'true'

  // 2. Server response arrives (source of truth from /app/features)
  if (features) {
    let nextActive = []
    if (Array.isArray(features.active_seasonal_themes)) {
      nextActive = features.active_seasonal_themes
    } else if (typeof features.halloween_enabled === 'boolean') {
      nextActive = features.halloween_enabled ? ['halloween'] : []
    }

    activeSeasonalThemes = nextActive
    isHalloweenAvailable = nextActive.includes('halloween')

    localStorageMock.setItem('moodshare_active_seasonal_themes', JSON.stringify(nextActive))
    localStorageMock.setItem('moodshare_server_halloween_available', String(isHalloweenAvailable))

    if (!isHalloweenAvailable) {
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
    activeSeasonalThemes,
    isHalloweenAvailable,
    isHalloween,
    activeClassApplied,
    showProfileSelector,
    showSidebarToggle,
    storage,
  }
}

test('Server feature integration - On and after November 5th (halloween_enabled: false)', () => {
  const result = simulateThemeSync({
    features: { halloween_enabled: false, server_time: '2026-11-05T00:00:00Z' },
    initialLocalStorage: {
      moodshare_server_halloween_available: 'true',
      moodshare_halloween: 'true',
    },
  })

  assert.equal(result.showProfileSelector, false, 'Profile Halloween selector must disappear')
  assert.equal(result.showSidebarToggle, false, 'Sidebar Halloween button must disappear')
  assert.equal(result.isHalloweenAvailable, false)
  assert.equal(result.isHalloween, false)
  assert.equal(result.activeClassApplied, false, '.halloween CSS class must NOT be applied')
  assert.equal(result.storage.moodshare_server_halloween_available, 'false')
  assert.equal(result.storage.moodshare_halloween, 'false')
})

test('Server feature integration - During Halloween season before Nov 5th (halloween_enabled: true)', () => {
  const result = simulateThemeSync({
    features: { halloween_enabled: true, server_time: '2026-10-31T20:00:00Z' },
    initialLocalStorage: {
      moodshare_halloween: 'true',
    },
  })

  assert.equal(result.showProfileSelector, true, 'Profile Halloween selector must be visible')
  assert.equal(result.showSidebarToggle, true, 'Sidebar Halloween button must be visible')
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

  assert.equal(result.showProfileSelector, true)
  assert.equal(result.showSidebarToggle, true)
  assert.equal(result.isHalloweenAvailable, true)
  assert.equal(result.isHalloween, false)
  assert.equal(result.activeClassApplied, false)
})

test('Scalable seasonal themes integration - Active themes array with multiple themes', () => {
  const result = simulateThemeSync({
    features: {
      active_seasonal_themes: ['halloween', 'new-year'],
      halloween_enabled: true,
      server_time: '2026-10-31T20:00:00Z',
    },
    initialLocalStorage: {
      moodshare_halloween: 'true',
    },
  })

  assert.deepEqual(result.activeSeasonalThemes, ['halloween', 'new-year'])
  assert.equal(result.isHalloweenAvailable, true)
  assert.equal(result.isHalloween, true)

  const available = getAvailableThemes(result.activeSeasonalThemes)
  const hasHalloweenLight = available.some((t) => t.id === 'halloween-light')
  assert.equal(hasHalloweenLight, true, 'Halloween themes must be present in available list')
})

test('Scalable seasonal themes integration - Season expiry gracefully reverts theme', () => {
  const activeThemesDuringSeason = ['halloween']
  assert.equal(isThemeAvailable('halloween-dark', activeThemesDuringSeason), true)

  const activeThemesAfterSeason = []
  assert.equal(isThemeAvailable('halloween-dark', activeThemesAfterSeason), false)

  // Reverts dark Halloween theme to standard dark
  assert.equal(getFallbackTheme('halloween-dark', activeThemesAfterSeason), 'dark')
  // Reverts light Halloween theme to standard light
  assert.equal(getFallbackTheme('halloween-light', activeThemesAfterSeason), 'light')
  // Permanent themes remain unchanged
  assert.equal(getFallbackTheme('forest-dark', activeThemesAfterSeason), 'forest-dark')
  assert.equal(getFallbackTheme('classic', activeThemesAfterSeason), 'classic')
})

