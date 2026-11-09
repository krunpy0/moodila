const key = (userId, date) => `moodila:entry-draft:${userId}:${date}`

export function readEntryDraft(userId, date) {
  if (!userId) return null
  try {
    return localStorage.getItem(key(userId, date))
  } catch {
    return null
  }
}

export function writeEntryDraft(userId, date, text) {
  if (!userId) return false
  try {
    if (text === null) localStorage.removeItem(key(userId, date))
    else localStorage.setItem(key(userId, date), text)
    return true
  } catch {
    return false
  }
}
