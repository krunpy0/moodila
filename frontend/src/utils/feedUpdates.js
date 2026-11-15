import { queryKeys } from '../api/queryKeys.js'

export function handlePushMessage(queryClient, message) {
  if (!['PUSH_NOTIFICATION_RECEIVED', 'PUSH_NOTIFICATION_READ'].includes(message?.type)) return

  for (const queryKey of [queryKeys.notifications, queryKeys.unreadCount, queryKeys.activePrompt, queryKeys.announcementsInbox, queryKeys.pendingFriends]) {
    queryClient.invalidateQueries({ queryKey })
  }
  // Keep loaded pages and scroll position until the reader requests a refresh.
  queryClient.invalidateQueries({ queryKey: ['feed'], refetchType: 'none' })
}

export function refreshFeed(queryClient, queryKey) {
  return queryClient.resetQueries({ queryKey, exact: true })
}

