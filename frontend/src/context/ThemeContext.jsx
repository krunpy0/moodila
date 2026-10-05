import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext({
  theme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
  isHalloween: false,
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

  const [isHalloween, setIsHalloween] = useState(() => {
    try {
      return localStorage.getItem('moodshare_halloween') === 'true'
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
    const root = document.documentElement
    if (isHalloween) {
      root.classList.add('halloween')
    } else {
      root.classList.remove('halloween')
    }
    try {
      localStorage.setItem('moodshare_halloween', String(isHalloween))
    } catch {
      // Storage quota or restriction fallback
    }
  }, [isHalloween])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const toggleHalloween = () => {
    setIsHalloween((prev) => !prev)
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        isHalloween,
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
