import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSession } from './auth'
import { deleteEntry, getEntry, getEntriesByMonth, getEntrySummary, getFriendEntriesByMonth, getStats, saveEntry, updateEntryVisibility } from './entries'
import { likeEntry, getFeed, getEntryReactions, getComments, addComment, deleteComment } from './feed'
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
export const useStatsQuery = (period = 'month') => useQuery({ queryKey: queryKeys.stats(period), queryFn: () => getStats(period), staleTime: STALE_TIMES.STANDARD })
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
export const useEntryReactionsQuery = (entryId, enabled = true) => useQuery({ queryKey: queryKeys.reactions(entryId), queryFn: () => getEntryReactions(entryId), enabled: Boolean(entryId) && enabled, staleTime: STALE_TIMES.DYNAMIC, retry: false, meta: { ignore404: true } })
export const useProfileQuery = () => useQuery({ queryKey: queryKeys.profile, queryFn: getMyProfile, staleTime: STALE_TIMES.STANDARD })
export const useFriendProfileQuery = (friendId, enabled = true) => useQuery({ queryKey: queryKeys.friendProfile(friendId), queryFn: () => getFriendProfile(friendId), enabled: Boolean(friendId) && enabled, staleTime: STALE_TIMES.STANDARD, retry: false })
export const useUserSearchQuery = (query) => useQuery({ queryKey: ['users', 'search', query], queryFn: () => searchUsers(query), enabled: Boolean(query), staleTime: STALE_TIMES.DYNAMIC })

export const useNotificationsQuery = (enabled = true) => useQuery({ queryKey: queryKeys.notifications, queryFn: () => fetchNotifications(), enabled, staleTime: STALE_TIMES.DYNAMIC })
export const useUnreadNotificationCountQuery = (enabled = true) => useQuery({ queryKey: queryKeys.unreadCount, queryFn: fetchUnreadNotificationCount, enabled, staleTime: STALE_TIMES.DYNAMIC })

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
    onMutate: async ({ entryId, reaction }) => {
      await queryClient.cancelQueries({ queryKey: ['feed'] })

      const previousFeedQueries = queryClient.getQueriesData({ queryKey: ['feed'] })

      queryClient.setQueriesData({ queryKey: ['feed'] }, (oldData) => {
        if (!oldData) return oldData

        const updateEntry = (entry) => {
          if (entry.id !== entryId) return entry

          const targetReac = reaction || '❤️'
          const existingMyReactions = entry.my_reactions || (entry.my_reaction ? [entry.my_reaction] : [])
          const hasTarget = existingMyReactions.includes(targetReac)

          let newMyReactions = []
          if (hasTarget) {
            newMyReactions = existingMyReactions.filter((r) => r !== targetReac)
          } else {
            newMyReactions = [...existingMyReactions, targetReac]
          }

          const existingReactions = entry.reactions || []
          let newReactions = existingReactions.map((r) => ({ ...r }))

          const rIdx = newReactions.findIndex((r) => r.reaction === targetReac)
          if (hasTarget) {
            if (rIdx !== -1) {
              newReactions[rIdx].count = Math.max(0, newReactions[rIdx].count - 1)
              newReactions[rIdx].reacted_by_me = false
              if (newReactions[rIdx].count === 0) {
                newReactions.splice(rIdx, 1)
              }
            }
          } else {
            if (rIdx !== -1) {
              newReactions[rIdx].count += 1
              newReactions[rIdx].reacted_by_me = true
            } else {
              newReactions.push({
                reaction: targetReac,
                count: 1,
                reacted_by_me: true,
              })
            }
          }

          newReactions.sort((a, b) => b.count - a.count)

          const newLikeCount = newReactions.reduce((sum, item) => sum + item.count, 0)
          const newLikedByMe = newMyReactions.length > 0
          const newMyReaction = newMyReactions[0] || ''

          return {
            ...entry,
            liked_by_me: newLikedByMe,
            my_reaction: newMyReaction,
            my_reactions: newMyReactions,
            reactions: newReactions,
            like_count: newLikeCount,
          }
        }

        if (oldData.pages) {
          return {
            ...oldData,
            pages: oldData.pages.map((page) => {
              const itemsKey = page.items ? 'items' : (page.entries ? 'entries' : null)
              if (!itemsKey) return page
              return {
                ...page,
                [itemsKey]: page[itemsKey].map(updateEntry),
              }
            }),
          }
        }

        if (Array.isArray(oldData)) {
          return oldData.map(updateEntry)
        }

        return oldData
      })

      return { previousFeedQueries }
    },
    onError: (err, newLike, context) => {
      if (context?.previousFeedQueries) {
        context.previousFeedQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
    },
    onSettled: (_, __, { entryId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feed })
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount })
      if (entryId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.reactions(entryId) })
      }
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
