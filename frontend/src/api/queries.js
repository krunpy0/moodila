import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSession } from './auth'
import { getEntry, getEntriesByMonth, getEntrySummary, getFriendEntriesByMonth, saveEntry, updateEntryVisibility } from './entries'
import { likeEntry, getFeed, getComments, addComment, deleteComment } from './feed'
import { acceptFriendRequest, declineFriendRequest, getFriends, getPendingFriends, searchUsers, sendFriendRequest } from './friends'
import { getMyProfile, updateMyProfile, getFriendProfile } from './users'
import { queryKeys } from './queryKeys'

import { fetchNotifications, fetchUnreadNotificationCount, markNotificationsAsRead } from './notifications'

export { queryKeys }

export const useSessionQuery = (enabled) => useQuery({ queryKey: queryKeys.session, queryFn: getSession, enabled, staleTime: 5 * 60_000 })
export const useEntryQuery = (date, enabled = true) => useQuery({ queryKey: queryKeys.entry(date), queryFn: () => getEntry(date), enabled, staleTime: 2 * 60_000, retry: false, meta: { ignore404: true } })
export const useEntriesQuery = (month, enabled = true) => useQuery({ queryKey: queryKeys.entries(month), queryFn: () => getEntriesByMonth(month), enabled: Boolean(month) && enabled, staleTime: 2 * 60_000 })
export const useEntrySummaryQuery = (month) => useQuery({ queryKey: queryKeys.entrySummary(month), queryFn: () => getEntrySummary(month), staleTime: 60_000 })
export const useFriendEntriesQuery = (friendId, month, enabled = true) => useQuery({ queryKey: queryKeys.friendEntries(friendId, month), queryFn: () => getFriendEntriesByMonth(friendId, month), enabled: Boolean(friendId) && Boolean(month) && enabled, staleTime: 2 * 60_000 })
export const useFriendsQuery = () => useQuery({ queryKey: queryKeys.friends, queryFn: getFriends, staleTime: 5 * 60_000 })
export const usePendingFriendsQuery = () => useQuery({ queryKey: queryKeys.pendingFriends, queryFn: getPendingFriends, staleTime: 30_000 })
export const useFeedQuery = () => useQuery({ queryKey: queryKeys.feed, queryFn: getFeed, staleTime: 30_000 })
export const useCommentsQuery = (entryId, enabled = true) => useQuery({ queryKey: queryKeys.comments(entryId), queryFn: () => getComments(entryId), enabled: Boolean(entryId) && enabled, staleTime: 30_000, retry: false, meta: { ignore404: true } })
export const useProfileQuery = () => useQuery({ queryKey: queryKeys.profile, queryFn: getMyProfile, staleTime: 60_000 })
export const useFriendProfileQuery = (friendId, enabled = true) => useQuery({ queryKey: queryKeys.friendProfile(friendId), queryFn: () => getFriendProfile(friendId), enabled: Boolean(friendId) && enabled, staleTime: 60_000, retry: false })
export const useUserSearchQuery = (query) => useQuery({ queryKey: ['users', 'search', query], queryFn: () => searchUsers(query), enabled: Boolean(query), staleTime: 30_000 })

export const useNotificationsQuery = (enabled = true) => useQuery({ queryKey: queryKeys.notifications, queryFn: () => fetchNotifications(), enabled, refetchInterval: 30_000 })
export const useUnreadNotificationCountQuery = (enabled = true) => useQuery({ queryKey: queryKeys.unreadCount, queryFn: fetchUnreadNotificationCount, enabled, refetchInterval: 15_000 })

export function useSaveEntryMutation() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: saveEntry, onSuccess: (entry) => {
    queryClient.invalidateQueries({ queryKey: ['entries', 'me'] })
    queryClient.invalidateQueries({ queryKey: ['entries', 'summary'] })
    queryClient.invalidateQueries({ queryKey: queryKeys.profile })
    queryClient.setQueryData(queryKeys.entry(entry.date), entry)
  }})
}

export function useUpdateEntryVisibilityMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ entryId, isHidden }) => updateEntryVisibility(entryId, isHidden),
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: ['entries', 'me'] })
      queryClient.invalidateQueries({ queryKey: ['entries', 'summary'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.profile })
      queryClient.setQueryData(queryKeys.entry(entry.date), entry)
    },
  })
}

export function useLikeEntryMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ entryId, reaction }) => likeEntry(entryId, reaction),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feed })
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount })
    },
  })
}

export function useAddCommentMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: addComment,
    onSuccess: (comment) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comments(comment.entry_id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.feed })
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount })
    },
  })
}

export function useDeleteCommentMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteComment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed', 'comments'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.feed })
    },
  })
}

function useFriendMutation(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn, onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.friends })
    queryClient.invalidateQueries({ queryKey: queryKeys.pendingFriends })
    queryClient.invalidateQueries({ queryKey: ['users', 'search'] })
    queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount })
  }})
}

export const useSendFriendRequestMutation = () => useFriendMutation(sendFriendRequest)
export const useAcceptFriendRequestMutation = () => useFriendMutation(acceptFriendRequest)
export const useDeclineFriendRequestMutation = () => useFriendMutation(declineFriendRequest)

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: updateMyProfile, onSuccess: (user) => {
    queryClient.setQueryData(queryKeys.profile, (current) => current ? { ...current, user } : current)
    queryClient.invalidateQueries({ queryKey: queryKeys.profile })
  } })
}

export function useMarkNotificationsAsReadMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: markNotificationsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications })
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount })
    },
  })
}
