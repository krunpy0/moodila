const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export const getCookie = (name) => {
  if (typeof document === 'undefined') return ''
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop().split(';').shift()
  return ''
}

export const getCSRFToken = () => {
  const cookieVal = getCookie('csrf_token')
  if (cookieVal) return cookieVal
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('csrf_token') || ''
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

export const apiURL = (path) => (/^https?:\/\//.test(path) ? path : BASE + path)

export async function api(path, options = {}) {
  const csrfToken = getCSRFToken()
  const res = await fetch(apiURL(path), {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Time-Zone': Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...options.headers,
    },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const error = new Error(body.error || `${res.status} ${res.statusText}`)
    error.status = res.status
    throw error
  }
  if (res.status === 204) return null
  const data = await res.json()
  if (data && typeof data === 'object' && data.csrf_token && typeof localStorage !== 'undefined') {
    localStorage.setItem('csrf_token', data.csrf_token)
  }
  return data
}

export const fetchClient = api

