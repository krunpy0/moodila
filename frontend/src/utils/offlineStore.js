// IndexedDB offline store for MoodShare PWA

const DB_NAME = 'MoodShareOfflineDB'
const DB_VERSION = 1
const STORE_ENTRIES = 'offline_entries'

function openDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB not supported'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_ENTRIES)) {
        const store = db.createObjectStore(STORE_ENTRIES, { keyPath: 'offline_id' })
        store.createIndex('date', 'date', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Save an entry locally when offline
 */
export async function saveOfflineEntry(entry) {
  const offlineId = `offline_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  const offlineEntry = {
    ...entry,
    offline_id: offlineId,
    created_at: entry.created_at || new Date().toISOString(),
    is_offline: true,
  }

  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ENTRIES, 'readwrite')
      const store = tx.objectStore(STORE_ENTRIES)
      const req = store.put(offlineEntry)
      req.onsuccess = () => resolve(offlineEntry)
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.warn('IndexedDB failed, fallback to localStorage', err)
    const existing = getLocalStorageOfflineEntries()
    const updated = [...existing.filter((e) => e.date !== entry.date), offlineEntry]
    localStorage.setItem(STORE_ENTRIES, JSON.stringify(updated))
    return offlineEntry
  }
}

/**
 * Get all pending offline entries
 */
export async function getOfflineEntries() {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ENTRIES, 'readonly')
      const store = tx.objectStore(STORE_ENTRIES)
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    return getLocalStorageOfflineEntries()
  }
}

/**
 * Remove an entry after successful sync
 */
export async function removeOfflineEntry(offlineId) {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ENTRIES, 'readwrite')
      const store = tx.objectStore(STORE_ENTRIES)
      const req = store.delete(offlineId)
      req.onsuccess = () => resolve(true)
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    const existing = getLocalStorageOfflineEntries()
    const filtered = existing.filter((e) => e.offline_id !== offlineId)
    localStorage.setItem(STORE_ENTRIES, JSON.stringify(filtered))
    return true
  }
}

/**
 * Sync all pending offline entries with backend
 */
export async function syncOfflineEntries(saveEntryApi) {
  const pending = await getOfflineEntries()
  if (!pending.length) return { synced: 0, failed: 0 }

  let syncedCount = 0
  let failedCount = 0

  for (const item of pending) {
    try {
      const { offline_id, is_offline, ...cleanEntry } = item
      await saveEntryApi(cleanEntry)
      await removeOfflineEntry(offline_id)
      syncedCount++
    } catch (err) {
      console.error('Failed to sync offline entry:', item, err)
      failedCount++
    }
  }

  return { synced: syncedCount, failed: failedCount }
}

function getLocalStorageOfflineEntries() {
  try {
    const data = localStorage.getItem(STORE_ENTRIES)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}
