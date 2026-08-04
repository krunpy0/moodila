import { api, setCSRFToken } from './client'

export const register = (data) =>
  api('/auth/register', { method: 'POST', body: JSON.stringify(data) })

export const login = (data) =>
  api('/auth/login', { method: 'POST', body: JSON.stringify(data) })

export const getSession = () => api('/auth/session')

export const logout = async () => {
  try {
    const res = await api('/auth/logout', { method: 'POST' })
    setCSRFToken('')
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('csrf_token')
      } catch (_) {}
    }
    return res
  } catch {
    setCSRFToken('')
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('csrf_token')
      } catch (_) {}
    }
    return null
  }
}

export const forgotPassword = (email) =>
  api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) })

export const resetPassword = (token, newPassword) =>
  api('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, new_password: newPassword }) })

export const changePassword = (oldPassword, newPassword) =>
  api('/auth/password', { method: 'PATCH', body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }) })

export const requestAccountDeletion = (password) =>
  api('/auth/account/delete-request', { method: 'POST', body: JSON.stringify({ password }) })

export const confirmAccountDeletion = (token) =>
  api('/auth/account/delete-confirm', { method: 'POST', body: JSON.stringify({ token }) })


