// Thin fetch wrapper for the MoodShare API. One place to set the base URL and
// (later) attach the auth token.
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export async function api(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.status === 204 ? null : res.json()
}
