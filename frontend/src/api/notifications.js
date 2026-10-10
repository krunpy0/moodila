import { api } from './client'

export function fetchNotifications(limit) {
  return api(`/notifications${limit ? `?limit=${limit}` : ''}`)
}

export function fetchUnreadNotificationCount() {
  return api('/notifications/unread-count')
}

export function markNotificationsAsRead(payload) {
  let body = {}
  if (Array.isArray(payload)) {
    body = { ids: payload }
  } else if (payload && typeof payload === 'object') {
    body = {
      ids: payload.ids || [],
      entry_ids: payload.entry_ids || payload.entryIds || [],
    }
  } else {
    body = { ids: [] }
  }
  return api('/notifications/mark-read', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function fetchNotificationSettings() {
  return api('/notifications/settings')
}

export function updateNotificationSettings(settings) {
  return api('/notifications/settings', {
    method: 'PATCH',
    body: JSON.stringify(settings),
  })
}
