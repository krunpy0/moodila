import { createContext, useContext, useEffect, useState } from 'react'
import { isHalloweenSeasonAvailable } from '../utils/halloweenSeason'

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

  const [isHalloweenAvailable, setIsHalloweenAvailable] = useState(() =>
    isHalloweenSeasonAvailable(),
  )

  const [isHalloween, setIsHalloween] = useState(() => {
    try {
      const inSeason = isHalloweenSeasonAvailable()
      return inSeason && localStorage.getItem('moodshare_halloween') === 'true'
    } catch {
      return false
    }
  })

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
    const checkSeason = () => {
      const available = isHalloweenSeasonAvailable()
      setIsHalloweenAvailable(available)
    }
    checkSeason()
  }, [])

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
