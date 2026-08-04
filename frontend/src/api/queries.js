import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSession } from './auth'
import { deleteEntry, getEntry, getEntriesByMonth, getEntrySummary, getFriendEntriesByMonth, saveEntry, updateEntryVisibility } from './entries'
import { likeEntry, getFeed, getComments, addComment, deleteComment } from './feed'
import { acceptFriendRequest, cancelFriendRequest, declineFriendRequest, getFriends, getPendingFriends, searchUsers, sendFriendRequest, unfriendUser } from './friends'
import { getMyProfile, updateMyProfile, getFriendProfile } from './users'
import { queryKeys } from './queryKeys'

import { fetchNotifications, fetchUnreadNotificationCount, markNotificationsAsRead } from './notifications'
import { archiveAdminAnnouncement, createAdminAnnouncement, getAdminAnnouncements, getUnreadAnnouncements, markAnnouncementRead, publishAdminAnnouncement, updateAdminAnnouncement } from './announcements'

export { queryKeys }

export const STALE_TIMES = {
  REALTIME: 10_000,      // 10s: fast updates (admin announcements)
  DYNAMIC: 30_000,       // 30s: dynamic feeds, comments, search, pending lists
  STANDARD: 60_000,      // 1m: summaries, profiles, announcements
  STABLE: 2 * 60_000,    // 2m: specific journal entries & monthly entries
  STATIC: 5 * 60_000,    // 5m: auth session, full friends list
}

export const useSessionQuery = (enabled) =>
  useQuery({
    queryKey: queryKeys.session,
    queryFn: getSession,
    enabled,
    staleTime: STALE_TIMES.STANDARD,
    retry: false,
  })
export const useEntryQuery = (date, enabled = true) => useQuery({ queryKey: queryKeys.entry(date), queryFn: () => getEntry(date), enabled, staleTime: STALE_TIMES.STABLE, retry: false, meta: { ignore404: true } })
export const useEntriesQuery = (month, enabled = true) => useQuery({ queryKey: queryKeys.entries(month), queryFn: () => getEntriesByMonth(month), enabled: Boolean(month) && enabled, staleTime: STALE_TIMES.STABLE })
export const useEntrySummaryQuery = (month) => useQuery({ queryKey: queryKeys.entrySummary(month), queryFn: () => getEntrySummary(month), staleTime: STALE_TIMES.STANDARD })
export const useFriendEntriesQuery = (friendId, month, enabled = true) => useQuery({ queryKey: queryKeys.friendEntries(friendId, month), queryFn: () => getFriendEntriesByMonth(friendId, month), enabled: Boolean(friendId) && Boolean(month) && enabled, staleTime: STALE_TIMES.STABLE })
export const useFriendsQuery = () => useQuery({ queryKey: queryKeys.friends, queryFn: getFriends, staleTime: STALE_TIMES.STATIC })
export const usePendingFriendsQuery = () => useQuery({ queryKey: queryKeys.pendingFriends, queryFn: getPendingFriends, staleTime: STALE_TIMES.DYNAMIC })
export const useFeedQuery = (includeSelf = false) => useQuery({ queryKey: queryKeys.feed(includeSelf), queryFn: () => getFeed({ includeSelf }), staleTime: STALE_TIMES.DYNAMIC })
export const useInfiniteFeedQuery = (limit = 10, includeSelf = false) =>
  useInfiniteQuery({
    queryKey: queryKeys.feed(includeSelf),
    queryFn: ({ pageParam }) => getFeed({ cursor: pageParam, limit, includeSelf }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor || undefined,
    staleTime: STALE_TIMES.DYNAMIC,
  })
export const useCommentsQuery = (entryId, enabled = true) => useQuery({ queryKey: queryKeys.comments(entryId), queryFn: () => getComments(entryId), enabled: Boolean(entryId) && enabled, staleTime: STALE_TIMES.DYNAMIC, retry: false, meta: { ignore404: true } })
export const useProfileQuery = () => useQuery({ queryKey: queryKeys.profile, queryFn: getMyProfile, staleTime: STALE_TIMES.STANDARD })
export const useFriendProfileQuery = (friendId, enabled = true) => useQuery({ queryKey: queryKeys.friendProfile(friendId), queryFn: () => getFriendProfile(friendId), enabled: Boolean(friendId) && enabled, staleTime: STALE_TIMES.STANDARD, retry: false })
export const useUserSearchQuery = (query) => useQuery({ queryKey: ['users', 'search', query], queryFn: () => searchUsers(query), enabled: Boolean(query), staleTime: STALE_TIMES.DYNAMIC })

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

export function useDeleteEntryMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteEntry,
    onSuccess: (_, entryIdOrDate) => {
      queryClient.invalidateQueries({ queryKey: ['entries', 'me'] })
      queryClient.invalidateQueries({ queryKey: ['entries', 'summary'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.profile })
      queryClient.invalidateQueries({ queryKey: queryKeys.feed })
      queryClient.removeQueries({ queryKey: queryKeys.entry(entryIdOrDate) })
    },
  })
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
    mutationFn: (variables) => {
      const commentId = typeof variables === 'object' ? variables.commentId : variables
      return deleteComment(commentId)
    },
    onSuccess: (_, variables) => {
      const entryId = typeof variables === 'object' ? variables.entryId : null
      if (entryId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.comments(entryId) })
      } else {
        queryClient.invalidateQueries({ queryKey: ['feed', 'comments'] })
      }
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
export const useUnfriendMutation = () => useFriendMutation(unfriendUser)
export const useCancelFriendRequestMutation = () => useFriendMutation(cancelFriendRequest)

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

export const useUnreadAnnouncementsQuery = (enabled = true) =>
  useQuery({ queryKey: queryKeys.unreadAnnouncements, queryFn: getUnreadAnnouncements, enabled, staleTime: STALE_TIMES.STANDARD })

export const useAdminAnnouncementsQuery = (enabled = true) =>
  useQuery({ queryKey: queryKeys.adminAnnouncements, queryFn: getAdminAnnouncements, enabled, staleTime: STALE_TIMES.REALTIME })

export function useMarkAnnouncementReadMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: markAnnouncementRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadAnnouncements })
    },
  })
}

export function useCreateAnnouncementMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createAdminAnnouncement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminAnnouncements })
    },
  })
}

export function useUpdateAnnouncementMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateAdminAnnouncement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminAnnouncements })
    },
  })
}

export function usePublishAnnouncementMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: publishAdminAnnouncement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminAnnouncements })
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadAnnouncements })
    },
  })
}

export function useArchiveAnnouncementMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: archiveAdminAnnouncement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminAnnouncements })
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadAnnouncements })
    },
  })
}
