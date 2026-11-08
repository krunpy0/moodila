import test from 'node:test'
import assert from 'node:assert/strict'
import { getAvailableThemes, getFallbackTheme, getFamilyCounterpartTheme } from './themes.js'

test('New Year variants are seasonal and fall back in the same mode', () => {
  for (const mode of ['light', 'dark']) {
    const id = `new-year-${mode}`
    assert.equal(getAvailableThemes([]).some(t => t.id === id), false)
    assert.equal(getAvailableThemes(['new-year']).some(t => t.id === id), true)
    assert.equal(getFallbackTheme(id, []), mode)
    assert.equal(getFallbackTheme(id, ['new-year']), id)
    assert.equal(getFamilyCounterpartTheme(id), `new-year-${mode === 'dark' ? 'light' : 'dark'}`)
  }
})
