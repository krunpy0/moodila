import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSession } from './auth'
import { getEntry, getEntriesByMonth, getEntrySummary, getFriendEntriesByMonth, saveEntry } from './entries'
import { likeEntry, getFeed } from './feed'
import { acceptFriendRequest, declineFriendRequest, getFriends, getPendingFriends, searchUsers, sendFriendRequest } from './friends'
import { getMyProfile, updateMyProfile, getFriendProfile } from './users'
import { queryKeys } from './queryKeys'

export { queryKeys }

export const useSessionQuery = (enabled) => useQuery({ queryKey: queryKeys.session, queryFn: getSession, enabled, staleTime: 5 * 60_000 })
export const useEntryQuery = (date, enabled = true) => useQuery({ queryKey: queryKeys.entry(date), queryFn: () => getEntry(date), enabled, staleTime: 2 * 60_000, retry: false })
export const useEntriesQuery = (month) => useQuery({ queryKey: queryKeys.entries(month), queryFn: () => getEntriesByMonth(month), staleTime: 2 * 60_000 })
export const useEntrySummaryQuery = (month) => useQuery({ queryKey: queryKeys.entrySummary(month), queryFn: () => getEntrySummary(month), staleTime: 60_000 })
export const useFriendEntriesQuery = (friendId, month, enabled) => useQuery({ queryKey: queryKeys.friendEntries(friendId, month), queryFn: () => getFriendEntriesByMonth(friendId, month), enabled, staleTime: 2 * 60_000 })
export const useFriendsQuery = () => useQuery({ queryKey: queryKeys.friends, queryFn: getFriends, staleTime: 5 * 60_000 })
export const usePendingFriendsQuery = () => useQuery({ queryKey: queryKeys.pendingFriends, queryFn: getPendingFriends, staleTime: 30_000 })
export const useFeedQuery = () => useQuery({ queryKey: queryKeys.feed, queryFn: getFeed, staleTime: 30_000 })
export const useProfileQuery = () => useQuery({ queryKey: queryKeys.profile, queryFn: getMyProfile, staleTime: 60_000 })
export const useFriendProfileQuery = (friendId, enabled = true) => useQuery({ queryKey: queryKeys.friendProfile(friendId), queryFn: () => getFriendProfile(friendId), enabled: Boolean(friendId) && enabled, staleTime: 60_000, retry: false })
export const useUserSearchQuery = (query) => useQuery({ queryKey: ['users', 'search', query], queryFn: () => searchUsers(query), enabled: Boolean(query), staleTime: 30_000 })

export function useSaveEntryMutation() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: saveEntry, onSuccess: (entry) => {
    queryClient.invalidateQueries({ queryKey: ['entries', 'me'] })
    queryClient.invalidateQueries({ queryKey: ['entries', 'summary'] })
    queryClient.setQueryData(queryKeys.entry(entry.date), entry)
  }})
}

export function useLikeEntryMutation() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: likeEntry, onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.feed }) })
}

function useFriendMutation(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn, onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.friends })
    queryClient.invalidateQueries({ queryKey: queryKeys.pendingFriends })
    queryClient.invalidateQueries({ queryKey: ['users', 'search'] })
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
