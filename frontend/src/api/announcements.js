import { api } from './client'

export function getUnreadAnnouncements() {
  return api('/announcements/unread')
}

export function markAnnouncementRead(id) {
  return api(`/announcements/${id}/read`, {
    method: 'POST',
  })
}

export function getAdminAnnouncements() {
  return api('/admin/announcements')
}

export function createAdminAnnouncement(data) {
  return api('/admin/announcements', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateAdminAnnouncement({ id, ...data }) {
  return api(`/admin/announcements/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function publishAdminAnnouncement(id) {
  return api(`/admin/announcements/${id}/publish`, {
    method: 'POST',
  })
}

export function archiveAdminAnnouncement(id) {
  return api(`/admin/announcements/${id}/archive`, {
    method: 'POST',
  })
}
