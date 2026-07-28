import { api } from './client'

export const getFeed = () => api('/feed')

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
