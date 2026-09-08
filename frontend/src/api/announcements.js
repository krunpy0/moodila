import { api } from './client'

export function getActivePrompt() {
  return api('/announcements/active-prompt')
}

export function dismissAnnouncement(id) {
  return api(`/announcements/${id}/dismiss`, {
    method: 'POST',
  })
}

export function acknowledgeAnnouncement(id) {
  return api(`/announcements/${id}/acknowledge`, {
    method: 'POST',
  })
}

export function getAnnouncementsInbox() {
  return api('/announcements/inbox')
}

export function markAnnouncementRead(id) {
  return api(`/announcements/${id}/read`, {
    method: 'POST',
  })
}

export function getUnreadAnnouncements() {
  return api('/announcements/unread')
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

export function unpublishAdminAnnouncement(id) {
  return api(`/admin/announcements/${id}/unpublish`, {
    method: 'POST',
  })
}

export function archiveAdminAnnouncement(id) {
  return api(`/admin/announcements/${id}/archive`, {
    method: 'POST',
  })
}

export function deleteAdminAnnouncement(id) {
  return api(`/admin/announcements/${id}`, {
    method: 'DELETE',
  })
}

export function getAdminAnnouncementStats(id) {
  return api(`/admin/announcements/${id}/stats`)
}
