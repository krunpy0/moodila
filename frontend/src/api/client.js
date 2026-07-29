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

export async function api(path, options = {}) {
  const csrfToken = getCookie('csrf_token')
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
  return res.status === 204 ? null : res.json()
}

export const fetchClient = api

