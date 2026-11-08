export function searchSnippet(text, query) {
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[её]/gi, '[её]')
  const pattern = escaped ? new RegExp(escaped, 'giu') : null
  const first = pattern?.exec(text)
  const start = first ? Math.max(0, first.index - 65) : 0
  const end = Math.min(text.length, Math.max(start + 220, (first?.index || 0) + query.trim().length + 65))
  const excerpt = text.slice(start, end)
  const parts = []
  let offset = 0
  if (start) parts.push({ text: '…' })
  if (pattern) {
    pattern.lastIndex = 0
    for (const match of excerpt.matchAll(pattern)) {
      parts.push({ text: excerpt.slice(offset, match.index) })
      parts.push({ text: match[0], match: true })
      offset = match.index + match[0].length
    }
  }
  parts.push({ text: excerpt.slice(offset) })
  if (end < text.length) parts.push({ text: '…' })
  return parts
}

export function searchRequest(params) {
  const result = new URLSearchParams(params)
  const month = result.get('month')
  result.delete('month')
  result.delete('period')
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) {
    const [year, m] = month.split('-').map(Number)
    result.set('from', `${month}-01`)
    result.set('to', `${month}-${new Date(year, m, 0).getDate()}`)
  }
  return result.toString()
}
