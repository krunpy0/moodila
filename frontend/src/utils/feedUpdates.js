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

export function trimFeedToFirstPage(queryClient, queryKey) {
  const state = queryClient.getQueryState(queryKey)
  // A first-page refetch can finish safely; pagination could restore discarded pages.
  if (state?.data?.pages.length > 1 || state?.fetchMeta?.fetchMore) {
    void queryClient.cancelQueries({ queryKey, exact: true })
  }
  queryClient.setQueryData(queryKey, (data) => data && {
    ...data,
    pages: data.pages.slice(0, 1),
    pageParams: data.pageParams.slice(0, 1),
  }, { updatedAt: state?.dataUpdatedAt })
  if (state?.isInvalidated) {
    void queryClient.invalidateQueries({ queryKey, exact: true, refetchType: 'none' })
  }
}

