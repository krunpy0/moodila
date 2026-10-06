import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAppFeaturesQuery } from '../api/queries'
import {
  THEMES,
  DEFAULT_THEME_ID,
  isDarkTheme,
  getFamilyCounterpartTheme,
  applyThemeToDOM,
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

  // Read initial server feature availability from cache to avoid layout/theme flash
  const [isHalloweenAvailable, setIsHalloweenAvailable] = useState(() => {
    try {
      return localStorage.getItem('moodshare_server_halloween_available') === 'true'
    } catch {
      return false
    }
  })

  const [isHalloween, setIsHalloween] = useState(() => {
    try {
      const cachedAvailable = localStorage.getItem('moodshare_server_halloween_available') === 'true'
      return cachedAvailable && localStorage.getItem('moodshare_halloween') === 'true'
    } catch {
      return false
    }
  })

  // Fetch seasonal feature availability from the server (single source of truth)
  const { data: features } = useAppFeaturesQuery()

  // Synchronize state when server features respond
  useEffect(() => {
    if (features && typeof features.halloween_enabled === 'boolean') {
      const enabled = features.halloween_enabled
      setIsHalloweenAvailable(enabled)
      try {
        localStorage.setItem('moodshare_server_halloween_available', String(enabled))
      } catch {
        // Storage quota fallback
      }
      if (!enabled) {
        setIsHalloween(false)
        try {
          localStorage.setItem('moodshare_halloween', 'false')
        } catch {
          // Storage quota fallback
        }
        // If current active theme was a Halloween theme and season ended, revert to classic light/dark
        setThemeState((current) => {
          if (current === 'halloween-light') return 'light'
          if (current === 'halloween-dark') return 'dark'
          return current
        })
      } else {
        try {
          if (localStorage.getItem('moodshare_halloween') === 'true') {
            setIsHalloween(true)
          }
        } catch {
          // Storage quota fallback
        }
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
