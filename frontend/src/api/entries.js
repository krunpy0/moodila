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

export const deleteEntry = (entryIdOrDate) => {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entryIdOrDate)
  if (isUUID) {
    return api(`/entries/${encodeURIComponent(entryIdOrDate)}`, { method: 'DELETE' })
  }
  return api(`/entries?date=${encodeURIComponent(entryIdOrDate)}`, { method: 'DELETE' })
}

export const requestPhotoUpload = (file) =>
  api('/storage/entry-photos/upload-url', {
    method: 'POST',
    body: JSON.stringify({ filename: file.name, content_type: file.type, size: file.size }),
  })

export async function uploadEntryPhoto(file) {
  const { upload_url: uploadURL, photo_url: photoURL } = await requestPhotoUpload(file)
  const response = await fetch(apiURL(uploadURL), {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
      'X-Time-Zone': Intl.DateTimeFormat().resolvedOptions().timeZone,
      Authorization: `Bearer ${getToken()}`,
    },
    body: file,
  })
  if (!response.ok) throw new Error('Could not upload photo. Please try again.')
  return photoURL
}

export const requestAudioUpload = (file) =>
  api('/storage/entry-audio/upload-url', {
    method: 'POST',
    body: JSON.stringify({ filename: file.name || 'voicenote.webm', content_type: file.type || 'audio/webm', size: file.size }),
  })

export async function uploadEntryAudio(audioBlob) {
  const file = new File([audioBlob], audioBlob.name || 'voicenote.webm', { type: audioBlob.type || 'audio/webm' })
  const { upload_url: uploadURL, audio_url: audioURL } = await requestAudioUpload(file)
  const response = await fetch(apiURL(uploadURL), {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
      'X-Time-Zone': Intl.DateTimeFormat().resolvedOptions().timeZone,
      Authorization: `Bearer ${getToken()}`,
    },
    body: file,
  })
  if (!response.ok) throw new Error('Could not upload voice note. Please try again.')
  return audioURL
}


