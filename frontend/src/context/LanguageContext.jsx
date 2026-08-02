import { createContext, useContext, useEffect, useState } from 'react'
import { en } from '../i18n/en'
import { ru } from '../i18n/ru'

const translations = { en, ru }

const LanguageContext = createContext({
  language: 'en',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key) => key,
  dateLocale: 'en-US',
  formatDate: (dateStr) => dateStr,
})

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    try {
      const stored = localStorage.getItem('moodshare_lang')
      if (stored === 'ru' || stored === 'en') {
        return stored
      }
    } catch {
      // Fallback to default English
    }
    return 'en'
  })

  useEffect(() => {
    try {
      localStorage.setItem('moodshare_lang', language)
      document.documentElement.lang = language
    } catch {
      // Storage restriction fallback
    }
  }, [language])

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'ru' ? 'en' : 'ru'))
  }

  const t = (key, params = {}) => {
    if (!key) return ''
    const keys = key.split('.')
    
    // Try target language first
    let val = getNestedValue(translations[language], keys)

    // Fallback to English if missing
    if (val === undefined && language !== 'en') {
      val = getNestedValue(translations.en, keys)
    }

    if (val === undefined) {
      return typeof params === 'string' ? params : key
    }

    if (typeof val === 'string' && params && typeof params === 'object') {
      return Object.entries(params).reduce((str, [pKey, pVal]) => {
        return str.replaceAll(`{${pKey}}`, String(pVal))
      }, val)
    }

    return val
  }

  const dateLocale = language === 'ru' ? 'ru-RU' : 'en-US'

  const formatDate = (value, options = { month: 'short', day: 'numeric' }) => {
    if (!value) return ''
    const dateObj = typeof value === 'string' ? new Date(`${value}T12:00:00`) : value
    return dateObj.toLocaleDateString(dateLocale, options)
  }

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        toggleLanguage,
        t,
        dateLocale,
        formatDate,
      }}
    >
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}

function getNestedValue(obj, keys) {
  let current = obj
  for (const k of keys) {
    if (current && typeof current === 'object' && k in current) {
      current = current[k]
    } else {
      return undefined
    }
  }
  return current
}
