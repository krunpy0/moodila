import { createContext, useContext, useEffect, useState } from 'react'
import { useAppFeaturesQuery } from '../api/queries'

const ThemeContext = createContext({
  theme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
  isHalloween: false,
  isHalloweenAvailable: false,
  setHalloween: () => {},
  toggleHalloween: () => {},
})

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem('moodshare_theme')
      if (stored === 'dark' || stored === 'light') {
        return stored
      }
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark'
      }
    } catch {
      // Fall back to light if localStorage/matchMedia is unavailable
    }
    return 'light'
  })

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

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    try {
      localStorage.setItem('moodshare_theme', theme)
    } catch {
      // Storage quota or restriction fallback
    }
  }, [theme])

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

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const toggleHalloween = () => {
    if (!isHalloweenAvailable) return
    setIsHalloween((prev) => !prev)
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        isHalloween: isHalloweenAvailable && isHalloween,
        isHalloweenAvailable,
        setHalloween: setIsHalloween,
        toggleHalloween,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
