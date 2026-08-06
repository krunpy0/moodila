const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

let inMemoryCSRF = ''

export const setCSRFToken = (token) => {
  if (typeof token === 'string' && token.trim() !== '') {
    inMemoryCSRF = token.trim()
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('csrf_token', inMemoryCSRF)
      } catch (_) {}
    }
  }
}

export const getCookie = (name) => {
  if (typeof document === 'undefined') return ''
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop().split(';').shift()
  return ''
}

export const getCSRFToken = () => {
  if (inMemoryCSRF) return inMemoryCSRF
  const cookieCsrf = getCookie('csrf_token')
  if (cookieCsrf) {
    setCSRFToken(cookieCsrf)
    return cookieCsrf
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem('csrf_token')
      if (stored) {
        inMemoryCSRF = stored
        return stored
      }
    } catch (_) {}
  }
  return ''
}

export const getLocalDate = () => {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

export const apiURL = (path) => {
  if (!path) return ''
  let url = /^https?:\/\//.test(path) ? path : BASE + path
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.startsWith('http://')) {
    url = 'https://' + url.slice(7)
  }
  return url
}

let refreshPromise = null

const extractCSRF = (res, bodyData) => {
  const headerCSRF = res && res.headers ? res.headers.get('X-CSRF-Token') : null
  if (headerCSRF) {
    setCSRFToken(headerCSRF)
  } else if (bodyData && (bodyData.csrf_token || bodyData.csrf)) {
    setCSRFToken(bodyData.csrf_token || bodyData.csrf)
  }
}

async function refreshToken() {
  if (!refreshPromise) {
    const csrf = getCSRFToken()
    refreshPromise = fetch(apiURL('/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      },
    })
      .then(async (res) => {
        refreshPromise = null
        if (!res.ok) {
          throw new Error('Refresh failed')
        }
        const data = await res.json()
        extractCSRF(res, data)
        return data
      })
      .catch((err) => {
        refreshPromise = null
        throw err
      })
  }
  return refreshPromise
}

export async function api(path, options = {}) {
  const csrfToken = getCSRFToken()
  const headers = {
    'Content-Type': 'application/json',
    'X-Time-Zone': Intl.DateTimeFormat().resolvedOptions().timeZone,
    ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    ...options.headers,
  }

  let res = await fetch(apiURL(path), {
    credentials: 'include',
    ...options,
    headers,
  })

  if (res && res.headers && res.headers.get('X-CSRF-Token')) {
    setCSRFToken(res.headers.get('X-CSRF-Token'))
  }

  if (
    res.status === 401 &&
    !options._isRetry &&
    !path.startsWith('/auth/login') &&
    !path.startsWith('/auth/register') &&
    !path.startsWith('/auth/refresh')
  ) {
    try {
      await refreshToken()
      const newCsrf = getCSRFToken()
      const newHeaders = {
        ...headers,
        ...(newCsrf ? { 'X-CSRF-Token': newCsrf } : {}),
      }
      res = await fetch(apiURL(path), {
        credentials: 'include',
        ...options,
        _isRetry: true,
        headers: newHeaders,
      })
      if (res && res.headers && res.headers.get('X-CSRF-Token')) {
        setCSRFToken(res.headers.get('X-CSRF-Token'))
      }
    } catch (_) {
      // Refresh failed, res remains 401
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    extractCSRF(res, body)
    const error = new Error(body.error || `${res.status} ${res.statusText}`)
    error.status = res.status
    throw error
  }

  if (res.status === 204) return null
  const data = await res.json()
  extractCSRF(res, data)
  return data
}

export const fetchClient = api

