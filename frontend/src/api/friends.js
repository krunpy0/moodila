import { api } from './client'

export const searchUsers = (query) =>
  api(`/users/search?q=${encodeURIComponent(query)}`)

export const sendFriendRequest = (userId) =>
  api('/friends/request', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  })

export const acceptFriendRequest = (friendshipId) =>
  api('/friends/accept', {
    method: 'POST',
    body: JSON.stringify({ friendship_id: friendshipId }),
  })

export const declineFriendRequest = (friendshipId) =>
  api('/friends/decline', {
    method: 'POST',
    body: JSON.stringify({ friendship_id: friendshipId }),
  })

export const getFriends = () => api('/friends')
export const getPendingFriends = () => api('/friends/pending')

