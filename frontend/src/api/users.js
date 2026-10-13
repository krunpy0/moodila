import { api } from './client'

export const getMyProfile = () => api('/users/me')
export const updateMyProfile = (payload) => api('/users/me', { method: 'PATCH', body: JSON.stringify(payload) })
export const getFriendProfile = (id) => api(`/users/${id}/profile`)

export const exportMyData = async () => {
  const data = await api('/users/me/export')
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const username = data?.user?.username || 'user'
  const date = new Date().toISOString().slice(0, 10)
  a.download = `moodila-export-${username}-${date}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return data
}


