const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export const getToken = () => {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('auth_token') || ''
  }
  return ''
}

export const setToken = (token) => {
  if (typeof localStorage !== 'undefined') {
    if (token) {
      localStorage.setItem('auth_token', token)
    } else {
      localStorage.removeItem('auth_token')
    }
  }
}

export const removeToken = () => {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('auth_token')
  }
}

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
  const token = getToken()
  const res = await fetch(apiURL(path), {
    headers: {
      'Content-Type': 'application/json',
      'X-Time-Zone': Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  })
  if (!res.ok) {
    if (res.status === 401) {
      removeToken()
    }
    const body = await res.json().catch(() => ({}))
    const error = new Error(body.error || `${res.status} ${res.statusText}`)
    error.status = res.status
    throw error
  }
  if (res.status === 204) return null
  const data = await res.json()
  if (data && typeof data === 'object' && data.token) {
    setToken(data.token)
  }
  return data
}

export const fetchClient = api

