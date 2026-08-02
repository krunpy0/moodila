import { api } from './client'

export const getFeed = ({ limit, cursor, includeSelf } = {}) => {
  const params = new URLSearchParams()
  if (limit) params.set('limit', limit)
  if (cursor) params.set('cursor', cursor)
  if (includeSelf !== undefined && includeSelf !== null) {
    params.set('include_self', includeSelf ? 'true' : 'false')
  }
  const queryString = params.toString()
  return api(`/feed${queryString ? `?${queryString}` : ''}`)
}


export const likeEntry = (entryId, reaction = '❤️') =>
  api(`/feed/${encodeURIComponent(entryId)}/like`, {
    method: 'POST',
    body: JSON.stringify({ reaction }),
  })

export const getComments = (entryId) =>
  api(`/feed/${encodeURIComponent(entryId)}/comments`)

export const addComment = ({ entryId, text }) =>
  api(`/feed/${encodeURIComponent(entryId)}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  })

export const deleteComment = (commentId) =>
  api(`/feed/comments/${encodeURIComponent(commentId)}`, {
    method: 'DELETE',
  })
