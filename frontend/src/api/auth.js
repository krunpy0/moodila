import { api } from './client'

export const register = (data) =>
  api('/auth/register', { method: 'POST', body: JSON.stringify(data) })

export const login = (data) =>
  api('/auth/login', { method: 'POST', body: JSON.stringify(data) })

export const getSession = () => api('/auth/session')

export const logout = async () => {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('csrf_token')
  }
  return api('/auth/logout', { method: 'POST' })
}
