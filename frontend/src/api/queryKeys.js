export const queryKeys = {
  entry: (date) => ['entries', 'me', 'date', date],
  entries: (month) => ['entries', 'me', month],
  entrySummary: (month) => ['entries', 'summary', month],
  friendEntries: (friendId, month) => ['entries', 'friend', friendId, month],
  friends: ['friends', 'list'],
  pendingFriends: ['friends', 'pending'],
  feed: ['feed'],
  session: ['auth', 'session'],
  profile: ['profile'],
  friendProfile: (id) => ['users', 'profile', id],
}
