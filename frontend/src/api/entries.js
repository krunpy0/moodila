import { api } from './client'

export const getEntry = (date) => api(`/entries/me?date=${encodeURIComponent(date)}`)

export const getEntriesByMonth = (month) =>
  api(`/entries/me?month=${encodeURIComponent(month)}`)

export const getEntrySummary = (month) =>
  api(`/entries/summary?month=${encodeURIComponent(month)}`)

export const saveEntry = (entry) =>
  api('/entries', { method: 'POST', body: JSON.stringify(entry) })
