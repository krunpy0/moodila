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

export const blockUser = (id) => api(`/users/${id}/block`, { method: 'POST' })
export const unblockUser = (id) => api(`/users/${id}/block`, { method: 'DELETE' })
export const getBlockedUsers = () => api('/users/blocked')

export const reportContent = ({ reported_user_id, entity_type, entity_id, reason, details }) =>
  api('/reports', {
    method: 'POST',
    body: JSON.stringify({ reported_user_id, entity_type, entity_id, reason, details }),
  })

export const getAdminReports = (status) => {
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  return api(`/admin/reports${query}`)
}

export const updateAdminReportStatus = ({ id, status }) =>
  api(`/admin/reports/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })

export const deleteAdminReportedContent = (id) =>
  api(`/admin/reports/${id}/delete-content`, {
    method: 'POST',
  })


