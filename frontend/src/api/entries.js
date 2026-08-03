import { api, apiURL, getToken } from './client'
import { saveOfflineEntry, syncOfflineEntries } from '../utils/offlineStore'

export const getEntry = (date) => api(`/entries/me?date=${encodeURIComponent(date)}`)

export const getEntriesByMonth = (month) =>
  api(`/entries/me?month=${encodeURIComponent(month)}`)

export const getFriendEntriesByMonth = (friendId, month) =>
  api(`/entries/friend/${encodeURIComponent(friendId)}?month=${encodeURIComponent(month)}`)

export const getEntrySummary = (month) =>
  api(`/entries/summary?month=${encodeURIComponent(month)}`)

export const saveEntryDirect = (entry) =>
  api('/entries', { method: 'POST', body: JSON.stringify(entry) })

export const saveEntry = async (entry) => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return saveOfflineEntry(entry)
  }
  try {
    return await saveEntryDirect(entry)
  } catch (err) {
    // If error is network related (e.g. Failed to fetch), store offline
    if (err.name === 'TypeError' || err.message?.includes('fetch') || !navigator.onLine) {
      console.warn('Network request failed, saving entry offline:', err)
      return saveOfflineEntry(entry)
    }
    throw err
  }
}

export const syncOfflineEntriesWithBackend = () => syncOfflineEntries(saveEntryDirect)

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

export const deleteStorageObject = (photoUrl) =>
  api('/storage/delete', {
    method: 'POST',
    body: JSON.stringify({ photo_url: photoUrl }),
  })

export const requestPhotoUpload = (file) =>

  api('/storage/entry-photos/upload-url', {
    method: 'POST',
    body: JSON.stringify({ filename: file.name, content_type: file.type, size: file.size }),
  })

export async function uploadEntryPhoto(file) {
  const { upload_url: uploadURL, photo_url: photoURL } = await requestPhotoUpload(file)
  const token = getToken()
  const response = await fetch(apiURL(uploadURL), {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
      'X-Time-Zone': Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: file,
  })
  if (!response.ok) {
    let msg = 'Could not upload photo. Please try again.'
    try {
      const data = await response.json()
      if (data && data.error) {
        msg = data.error
      }
    } catch (_) {}
    throw new Error(msg)
  }
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
  const token = getToken()
  const response = await fetch(apiURL(uploadURL), {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
      'X-Time-Zone': Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: file,
  })
  if (!response.ok) {
    let msg = 'Could not upload voice note. Please try again.'
    try {
      const data = await response.json()
      if (data && data.error) {
        msg = data.error
      }
    } catch (_) {}
    throw new Error(msg)
  }
  return audioURL
}


