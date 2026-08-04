const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export const getCookie = (name) => {
  if (typeof document === 'undefined') return ''
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop().split(';').shift()
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

export const apiURL = (path) => (/^https?:\/\//.test(path) ? path : BASE + path)

let refreshPromise = null

async function refreshToken() {
  if (!refreshPromise) {
    refreshPromise = fetch(apiURL('/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCookie('csrf_token'),
      },
    })
      .then((res) => {
        refreshPromise = null
        if (!res.ok) {
          throw new Error('Refresh failed')
        }
        return res.json()
      })
      .catch((err) => {
        refreshPromise = null
        throw err
      })
  }
  return refreshPromise
}

export async function api(path, options = {}) {
  const csrfToken = getCookie('csrf_token')
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

  if (
    res.status === 401 &&
    !options._isRetry &&
    !path.startsWith('/auth/login') &&
    !path.startsWith('/auth/register') &&
    !path.startsWith('/auth/refresh')
  ) {
    try {
      await refreshToken()
      const newCsrf = getCookie('csrf_token')
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
    } catch (_) {
      // Refresh failed, res remains 401
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const error = new Error(body.error || `${res.status} ${res.statusText}`)
    error.status = res.status
    throw error
  }

  if (res.status === 204) return null
  return await res.json()
}

export const fetchClient = api

