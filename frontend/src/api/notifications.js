import { api } from './client'

export function fetchNotifications(limit) {
  return api(`/notifications${limit ? `?limit=${limit}` : ''}`)
}

export function fetchUnreadNotificationCount() {
  return api('/notifications/unread-count')
}

export function markNotificationsAsRead(ids) {
  return api('/notifications/mark-read', {
    method: 'POST',
    body: JSON.stringify({ ids: ids || [] }),
  })
}
