import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  acceptFriendRequest,
  declineFriendRequest,
  getFriends,
  getPendingFriends,
  searchUsers,
  sendFriendRequest,
} from '../api/friends'
import BottomNav from '../components/BottomNav'

export default function Friends() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [pending, setPending] = useState([])
  const [friends, setFriends] = useState([])
  const [busy, setBusy] = useState('')
  const [status, setStatus] = useState('Loading friends...')
  const navigate = useNavigate()

  const loadLists = () =>
    Promise.all([getPendingFriends(), getFriends()]).then(([requests, accepted]) => {
      setPending(requests)
      setFriends(accepted)
      setStatus('')
    })

  useEffect(() => {
    loadLists().catch((error) => setStatus(error.message))
  }, [])

  useEffect(() => {
    const value = query.trim().toLowerCase()
    if (!value) {
      setResults([])
      return undefined
    }
    const timer = setTimeout(() => {
      searchUsers(value)
        .then(setResults)
        .catch((error) => setStatus(error.message))
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  const act = async (key, request, refreshSearch = false) => {
    setBusy(key)
    setStatus('')
    try {
      await request()
      await loadLists()
      if (refreshSearch && query.trim()) {
        setResults(await searchUsers(query.trim().toLowerCase()))
      }
    } catch (error) {
      setStatus(error.message)
    } finally {
      setBusy('')
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-background pb-32 text-on-background">
      <header className="flex items-center justify-between px-container-margin py-md">
        <div className="flex items-center gap-sm">
          <button
            type="button"
            aria-label="Go back"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-primary"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-headline-lg-mobile font-headline-lg-mobile text-on-surface">
            Add Friends
          </h1>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant bg-primary-container text-primary">
          <span className="material-symbols-outlined text-[20px]">person</span>
        </div>
      </header>

      <div className="space-y-lg px-container-margin pt-md">
        <label className="relative block">
          <span className="sr-only">Find friends by username</span>
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
            <span className="material-symbols-outlined text-[20px] text-outline">search</span>
          </span>
          <input
            type="search"
            value={query}
            maxLength={24}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find friends by username"
            className="w-full rounded-full border-0 bg-surface-container-low py-4 pl-12 pr-4 text-body-md text-on-surface outline-none cloud-shadow placeholder:text-outline focus:ring-2 focus:ring-primary/20"
          />
        </label>

        {query.trim() && (
          <UserSection title="Search results">
            {results.map((user) => (
              <UserCard key={user.id} user={user}>
                <SearchAction
                  user={user}
                  busy={busy === user.id}
                  onSend={() =>
                    act(user.id, () => sendFriendRequest(user.id), true)
                  }
                />
              </UserCard>
            ))}
            {results.length === 0 && <Empty text="No users found." />}
          </UserSection>
        )}

        <UserSection title="Pending requests" count={pending.length}>
          {pending.map((user) => (
            <UserCard key={user.friendship_id} user={user}>
              <div className="flex gap-xs">
                <CircleButton
                  label={`Decline request from ${user.display_name}`}
                  icon="close"
                  disabled={busy === user.friendship_id}
                  onClick={() =>
                    act(user.friendship_id, () =>
                      declineFriendRequest(user.friendship_id),
                    )
                  }
                />
                <CircleButton
                  primary
                  label={`Accept request from ${user.display_name}`}
                  icon="check"
                  disabled={busy === user.friendship_id}
                  onClick={() =>
                    act(user.friendship_id, () =>
                      acceptFriendRequest(user.friendship_id),
                    )
                  }
                />
              </div>
            </UserCard>
          ))}
          {pending.length === 0 && <Empty text="No pending requests." />}
        </UserSection>

        <UserSection title="My friends">
          {friends.map((user) => (
            <UserCard key={user.id} user={user} />
          ))}
          {friends.length === 0 && <Empty text="Your friends will appear here." />}
        </UserSection>

        {status && (
          <p
            role="status"
            className={`text-center text-body-sm ${
              status === 'Loading friends...' ? 'text-on-surface-variant' : 'text-error'
            }`}
          >
            {status}
          </p>
        )}
      </div>
      <BottomNav />
    </main>
  )
}

function UserSection({ title, count, children }) {
  return (
    <section className="space-y-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-label-lg font-label-lg text-on-surface-variant">{title}</h2>
        {count > 0 && (
          <span className="text-label-sm font-label-sm text-primary">See all ({count})</span>
        )}
      </div>
      <div className="space-y-sm">{children}</div>
    </section>
  )
}

function UserCard({ user, children }) {
  return (
    <div className="flex min-h-[112px] items-center justify-between gap-sm rounded-[24px] border border-surface-container bg-white p-lg cloud-shadow">
      <div className="flex min-w-0 items-center gap-md">
        <Avatar user={user} />
        <div className="min-w-0">
          <p className="truncate text-body-md font-semibold text-on-surface">
            {user.display_name || user.username}
          </p>
          <p className="truncate text-label-sm text-on-surface-variant">@{user.username}</p>
        </div>
      </div>
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

function SearchAction({ user, busy, onSend }) {
  if (user.status === 'accepted') {
    return <CircleButton label="Already friends" icon="check" disabled />
  }
  if (user.status === 'pending') {
    return (
      <CircleButton
        label={user.requester_is_me ? 'Request sent' : 'Request received'}
        icon={user.requester_is_me ? 'schedule' : 'mail'}
        disabled
      />
    )
  }
  return (
    <CircleButton
      primary
      label={`Send friend request to ${user.display_name}`}
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

