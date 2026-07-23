import { api } from './client'

export const getFeed = () => api('/feed')

export const likeEntry = (entryId) =>
  api(`/feed/${encodeURIComponent(entryId)}/like`, { method: 'POST' })
