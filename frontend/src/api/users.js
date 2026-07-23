import { api } from './client'

export const getMyProfile = () => api('/users/me')
export const updateMyProfile = (payload) => api('/users/me', { method: 'PATCH', body: JSON.stringify(payload) })
