import { useDeferredValue, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAcceptFriendRequestMutation, useCancelFriendRequestMutation, useDeclineFriendRequestMutation, useFriendsQuery, usePendingFriendsQuery, useSendFriendRequestMutation, useUnfriendMutation, useUserSearchQuery } from '../api/queries'
import BottomNav from '../components/BottomNav'
import HeaderBell from '../components/HeaderBell'
import { FriendsSkeleton } from '../components/skeleton/PageSkeletons'
import { useLanguage } from '../context/LanguageContext'

export default function Friends() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const { t } = useLanguage()
  const searchTerm = useDeferredValue(query.trim().toLowerCase())
  const friendsQuery = useFriendsQuery()
  const pendingQuery = usePendingFriendsQuery()
  const searchQuery = useUserSearchQuery(searchTerm)
  const sendRequest = useSendFriendRequestMutation()
  const acceptRequest = useAcceptFriendRequestMutation()
  const declineRequest = useDeclineFriendRequestMutation()
  const unfriend = useUnfriendMutation()
  const cancelRequest = useCancelFriendRequestMutation()
  const friends = friendsQuery.data || []
  const pending = pendingQuery.data || []
  const results = searchQuery.data || []
  const isLoading = friendsQuery.isLoading || pendingQuery.isLoading
  const error = friendsQuery.error || pendingQuery.error || searchQuery.error || sendRequest.error || acceptRequest.error || declineRequest.error || unfriend.error || cancelRequest.error

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-background pb-32 text-on-background">
      <header className="flex items-center justify-between px-container-margin py-md">
        <div className="flex items-center gap-sm">
          <button
            type="button"
            aria-label={t('common.back')}
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-primary"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-headline-lg-mobile font-headline-lg-mobile text-on-surface">
            {t('friends.title')}
          </h1>
        </div>
        <div className="flex items-center gap-xs">
          <HeaderBell />
        </div>
      </header>

      <div className="space-y-lg px-container-margin pt-md">
        <label className="relative block">
          <span className="sr-only">{t('friends.searchPlaceholder')}</span>
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
            <span className="material-symbols-outlined text-[20px] text-outline">search</span>
          </span>
          <input
            type="search"
            value={query}
            maxLength={24}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('friends.searchPlaceholder')}
            className="w-full rounded-full border-0 bg-surface-container-low py-4 pl-12 pr-4 text-body-md text-on-surface outline-none cloud-shadow placeholder:text-outline focus:ring-2 focus:ring-primary/20"
          />
        </label>

        {!isLoading && query.trim() && (
          <UserSection title={t('common.seeAll')}>
            {results.map((user) => (
              <UserCard key={user.id} user={user}>
                <SearchAction
                  user={user}
                  busy={sendRequest.isPending && sendRequest.variables === user.id}
                  onSend={() => sendRequest.mutate(user.id)}
                  onCancel={() => cancelRequest.mutate(user.id)}
                  onUnfriend={() => unfriend.mutate(user.id)}
                  unfriendBusy={unfriend.isPending}
                  cancelBusy={cancelRequest.isPending}
                />
              </UserCard>
            ))}
            {results.length === 0 && <Empty text={t('friends.noFriends')} />}
          </UserSection>
        )}

        {isLoading ? <FriendsSkeleton /> : <>
        <UserSection title={t('friends.pendingRequests')} count={pending.length}>
          {pending.map((user) => (
            <UserCard key={user.friendship_id} user={user}>
              <div className="flex gap-xs">
                <CircleButton
                  label={t('friends.decline')}
                  icon="close"
                  disabled={declineRequest.isPending}
                  onClick={() => declineRequest.mutate(user.friendship_id)}
                />
                <CircleButton
                  primary
                  label={t('friends.accept')}
                  icon="check"
                  disabled={acceptRequest.isPending}
                  onClick={() => acceptRequest.mutate(user.friendship_id)}
                />
              </div>
            </UserCard>
          ))}
          {pending.length === 0 && <Empty text={t('friends.noPending')} />}
        </UserSection>

        <UserSection title={t('friends.myFriends')}>
          {friends.map((user) => (
            <UserCard key={user.id} user={user}>
              <CircleButton
                label={t('friends.removeFriend')}
                icon="person_remove"
                disabled={unfriend.isPending}
                onClick={() => unfriend.mutate(user.id)}
              />
            </UserCard>
          ))}
          {friends.length === 0 && <Empty text={t('friends.noFriends')} />}
        </UserSection>

        </>}
        {error && (
          <p role="alert" className="text-center text-body-sm text-error">
            {error.message}
          </p>
        )}
      </div>
      <BottomNav />
    </main>
  )
}

function UserSection({ title, count, children }) {
  const { t } = useLanguage()
  return (
    <section className="space-y-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-label-lg font-label-lg text-on-surface-variant">{title}</h2>
        {count > 0 && (
          <span className="text-label-sm font-label-sm text-primary">{t('common.seeAll')} ({count})</span>
        )}
      </div>
      <div className="space-y-sm">{children}</div>
    </section>
  )
}

function UserCard({ user, children }) {
  const isFriend = !user.status || user.status === 'accepted'
  return (
    <div className="flex min-h-[112px] items-center justify-between gap-sm rounded-[24px] border border-surface-container bg-white p-lg cloud-shadow">
      {isFriend ? (
        <Link to={`/profile/${user.id}`} className="flex min-w-0 flex-1 items-center gap-md rounded-xl transition-opacity hover:opacity-80">
          <Avatar user={user} />
          <div className="min-w-0">
            <p className="truncate text-body-md font-semibold text-on-surface">
              {user.display_name || user.username}
            </p>
            <p className="truncate text-label-sm text-on-surface-variant">@{user.username}</p>
          </div>
        </Link>
      ) : (
        <div className="flex min-w-0 items-center gap-md">
          <Avatar user={user} />
          <div className="min-w-0">
            <p className="truncate text-body-md font-semibold text-on-surface">
              {user.display_name || user.username}
            </p>
            <p className="truncate text-label-sm text-on-surface-variant">@{user.username}</p>
          </div>
        </div>
      )}
      {children}
    </div>
  )
}

function Avatar({ user }) {
  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt=""
        className="h-14 w-14 shrink-0 rounded-full object-cover"
      />
    )
  }
  const initials = (user.display_name || user.username)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-secondary-container text-headline-lg-mobile font-semibold text-secondary">
      {initials}
    </span>
  )
}

function SearchAction({ user, busy, onSend, onCancel, onUnfriend, unfriendBusy, cancelBusy }) {
  const { t } = useLanguage()
  if (user.status === 'accepted') {
    return (
      <CircleButton
        label={t('friends.removeFriend')}
        icon="person_remove"
        disabled={unfriendBusy}
        onClick={onUnfriend}
      />
    )
  }
  if (user.status === 'pending') {
    if (user.requester_is_me) {
      return (
        <CircleButton
          label={t('common.cancel')}
          icon="close"
          disabled={cancelBusy}
          onClick={onCancel}
        />
      )
    }
    return (
      <CircleButton
        label={t('friends.pendingRequests')}
        icon="mail"
        disabled
      />
    )
  }
  return (
    <CircleButton
      primary
      label={t('friends.sendRequest')}
      icon="person_add"
      disabled={busy}
      onClick={onSend}
    />
  )
}

function CircleButton({ label, icon, primary = false, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-60 ${
        primary
          ? 'bg-primary text-on-primary'
          : 'bg-surface-container-highest text-on-surface-variant'
      }`}
      {...props}
    >
      <span className="material-symbols-outlined">{icon}</span>
    </button>
  )
}

function Empty({ text }) {
  return (
    <p className="rounded-[24px] bg-surface-container-low px-lg py-md text-center text-body-sm text-on-surface-variant">
      {text}
    </p>
  )
}
