import test from 'node:test'
import assert from 'node:assert/strict'
import { readEntryDraft, writeEntryDraft } from './entryDraft.js'

test('drafts survive reopening, isolate accounts and dates, and preserve empty edits', () => {
  const values = new Map()
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
  try {
    assert.equal(writeEntryDraft('a', '2026-11-09', 'Unfinished note'), true)
    assert.equal(readEntryDraft('a', '2026-11-09'), 'Unfinished note')
    assert.equal(readEntryDraft('b', '2026-11-09'), null)
    assert.equal(readEntryDraft('a', '2026-11-08'), null)
    writeEntryDraft('a', '2026-11-09', '')
    assert.equal(readEntryDraft('a', '2026-11-09'), '')
    writeEntryDraft('a', '2026-11-09', null)
    assert.equal(readEntryDraft('a', '2026-11-09'), null)
    assert.equal(writeEntryDraft(null, '2026-11-09', 'private'), false)
  } finally {
    delete globalThis.localStorage
  }
})

test('unavailable storage does not crash the editor and reports a failed write', () => {
  assert.equal(readEntryDraft('a', '2026-11-09'), null)
  assert.equal(writeEntryDraft('a', '2026-11-09', 'note'), false)
})
