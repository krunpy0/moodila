import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { useAppFeaturesQuery } from '../api/queries'
import {
  THEMES,
  DEFAULT_THEME_ID,
  isDarkTheme,
  getFamilyCounterpartTheme,
  applyThemeToDOM,
  isThemeFamilyAvailable,
  isThemeAvailable,
  getFallbackTheme,
} from '../utils/themes'
import ThemePickerModal from '../components/ThemePickerModal'

const ThemeContext = createContext({
  theme: DEFAULT_THEME_ID,
  isDark: false,
  setTheme: () => {},
  toggleTheme: () => {},
  isThemePickerOpen: false,
  openThemePicker: () => {},
  closeThemePicker: () => {},
  activeSeasonalThemes: [],
  isThemeAvailable: () => true,
  isFamilyAvailable: () => true,
  isHalloween: false,
  isHalloweenAvailable: false,
  setHalloween: () => {},
  toggleHalloween: () => {},
})

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const stored = localStorage.getItem('moodshare_theme')
      if (stored && THEMES.some((t) => t.id === stored)) {
        return stored
      }
      if (stored === 'dark') {
        return 'dark'
      }
      if (stored === 'light') {
        return 'light'
      }
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark'
      }
    } catch {
      // Fall back to default light if localStorage/matchMedia is unavailable
    }
    return DEFAULT_THEME_ID
  })

  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false)

  // Read initial server seasonal theme availability from cache to avoid layout/theme flash
  const [activeSeasonalThemes, setActiveSeasonalThemes] = useState(() => {
    try {
      const stored = localStorage.getItem('moodshare_active_seasonal_themes')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) return parsed
      }
      if (localStorage.getItem('moodshare_server_halloween_available') === 'true') {
        return ['halloween']
      }
    } catch {
      // Storage fallback
    }
    return []
  })

  const isHalloweenAvailable = useMemo(
    () => activeSeasonalThemes.includes('halloween'),
    [activeSeasonalThemes]
  )

  const [isHalloween, setIsHalloween] = useState(() => {
    try {
      const cachedStored = localStorage.getItem('moodshare_active_seasonal_themes')
      const isAvailable = cachedStored
        ? JSON.parse(cachedStored).includes('halloween')
        : localStorage.getItem('moodshare_server_halloween_available') === 'true'
      return isAvailable && localStorage.getItem('moodshare_halloween') === 'true'
    } catch {
      return false
    }
  })

  // Fetch seasonal feature availability from the server (single source of truth)
  const { data: features } = useAppFeaturesQuery()

  // Synchronize state when server features respond
  useEffect(() => {
    if (!features) return

    let nextActive = []
    if (Array.isArray(features.active_seasonal_themes)) {
      nextActive = features.active_seasonal_themes
    } else if (features.halloween_enabled) {
      nextActive = ['halloween']
    }

    setActiveSeasonalThemes(nextActive)

    try {
      localStorage.setItem('moodshare_active_seasonal_themes', JSON.stringify(nextActive))
      localStorage.setItem(
        'moodshare_server_halloween_available',
        String(nextActive.includes('halloween'))
      )
    } catch {
      // Storage quota fallback
    }

    // Gracefully revert any active theme whose season has ended
    setThemeState((current) => getFallbackTheme(current, nextActive))

    if (!nextActive.includes('halloween')) {
      setIsHalloween(false)
      try {
        localStorage.setItem('moodshare_halloween', 'false')
      } catch {
        // Storage quota fallback
      }
    } else {
      try {
        if (localStorage.getItem('moodshare_halloween') === 'true') {
          setIsHalloween(true)
        }
      } catch {
        // Storage quota fallback
      }
    }
  }, [features])

  // Synchronously apply theme attributes whenever theme changes
  useEffect(() => {
    applyThemeToDOM(theme)
    try {
      localStorage.setItem('moodshare_theme', theme)
    } catch {
      // Storage quota or restriction fallback
    }
  }, [theme])

  // Seasonal Halloween styling class
  useEffect(() => {
    const root = document.documentElement
    const active = isHalloweenAvailable && isHalloween
    if (active) {
      root.classList.add('halloween')
    } else {
      root.classList.remove('halloween')
    }
    try {
      localStorage.setItem('moodshare_halloween', String(active))
    } catch {
      // Storage quota or restriction fallback
    }
  }, [isHalloween, isHalloweenAvailable])

  const setTheme = useCallback((nextTheme) => {
    setThemeState(nextTheme)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => getFamilyCounterpartTheme(prev))
  }, [])

  const openThemePicker = useCallback(() => {
    setIsThemePickerOpen(true)
  }, [])

  const closeThemePicker = useCallback(() => {
    setIsThemePickerOpen(false)
  }, [])

  const toggleHalloween = useCallback(() => {
    if (!isHalloweenAvailable) return
    setIsHalloween((prev) => !prev)
  }, [isHalloweenAvailable])

  const isDark = isDarkTheme(theme)

  const checkThemeAvailable = useCallback(
    (themeId) => isThemeAvailable(themeId, activeSeasonalThemes),
    [activeSeasonalThemes]
  )

  const checkFamilyAvailable = useCallback(
    (familyId) => isThemeFamilyAvailable(familyId, activeSeasonalThemes),
    [activeSeasonalThemes]
  )

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark,
        setTheme,
        toggleTheme,
        isThemePickerOpen,
        openThemePicker,
        closeThemePicker,
        activeSeasonalThemes,
        isThemeAvailable: checkThemeAvailable,
        isFamilyAvailable: checkFamilyAvailable,
        isHalloween: theme.startsWith('halloween-') || (isHalloweenAvailable && isHalloween),
        isHalloweenAvailable,
        setHalloween: setIsHalloween,
        toggleHalloween,
      }}
    >
      {children}
      <ThemePickerModal
        isOpen={isThemePickerOpen}
        onClose={closeThemePicker}
      />
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
