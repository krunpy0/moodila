import assert from 'node:assert/strict'
import { test } from 'node:test'
import { searchSnippet, searchRequest } from './entrySearch.js'

test('literal matching ignores case and treats е and ё equally', () => {
  const parts = searchSnippet('Перед ЭКЗАМЁНОМ был экзамен. 100% [ok] <script>', 'экзамен')
  assert.deepEqual(parts.filter((part) => part.match).map((part) => part.text), ['ЭКЗАМЁН', 'экзамен'])
  assert.equal(searchSnippet('100% [ok]', '[ok]').filter((part) => part.match)[0].text, '[ok]')
  assert.equal(searchSnippet('100%', '%').filter((part) => part.match)[0].text, '%')
})
test('snippet is centered on a late match and preserves text', () => {
  const parts = searchSnippet('a'.repeat(500) + 'Экзамен' + 'b'.repeat(500), 'экзамен')
  assert.equal(parts[0].text, '…')
  assert.equal(parts.at(-1).text, '…')
  assert.equal(parts.filter((part) => part.match)[0].text, 'Экзамен')
  assert.equal(searchSnippet('<script>', '').map((part) => part.text).join(''), '<script>')
})
test('month bounds include leap day and preserve multiple filters', () => {
  const result = new URLSearchParams(searchRequest('month=2024-02&mood=1&mood=5&tag=Calm&tag=Work'))
  assert.equal(result.get('from'), '2024-02-01')
  assert.equal(result.get('to'), '2024-02-29')
  assert.deepEqual(result.getAll('mood'), ['1', '5'])
  assert.deepEqual(result.getAll('tag'), ['Calm', 'Work'])
})
