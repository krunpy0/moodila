import { api, apiURL, getToken } from './client'

export const getEntry = (date) => api(`/entries/me?date=${encodeURIComponent(date)}`)

export const getEntriesByMonth = (month) =>
  api(`/entries/me?month=${encodeURIComponent(month)}`)

export const getFriendEntriesByMonth = (friendId, month) =>
  api(`/entries/friend/${encodeURIComponent(friendId)}?month=${encodeURIComponent(month)}`)

export const getEntrySummary = (month) =>
  api(`/entries/summary?month=${encodeURIComponent(month)}`)

export const saveEntry = (entry) =>
  api('/entries', { method: 'POST', body: JSON.stringify(entry) })

export const updateEntryVisibility = (entryId, isHidden) =>
  api(`/entries/${encodeURIComponent(entryId)}/visibility`, {
    method: 'PATCH',
    body: JSON.stringify({ is_hidden: isHidden }),
  })

export const requestPhotoUpload = (file) =>
  api('/storage/entry-photos/upload-url', {
    method: 'POST',
    body: JSON.stringify({ filename: file.name, content_type: file.type, size: file.size }),
  })

export async function uploadEntryPhoto(file) {
  const { upload_url: uploadURL, photo_url: photoURL } = await requestPhotoUpload(file)
  const response = await fetch(apiURL(uploadURL), {
    method: 'PUT',
    headers: { 'Content-Type': file.type, Authorization: `Bearer ${getToken()}` },
    body: file,
  })
  if (!response.ok) throw new Error('Could not upload photo. Please try again.')
  return photoURL
}
