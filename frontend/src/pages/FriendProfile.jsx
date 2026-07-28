import { useParams, useNavigate, Link } from 'react-router-dom'
import { useFriendProfileQuery } from '../api/queries'
import BottomNav from '../components/BottomNav'
import { ProfileSkeleton } from '../components/skeleton/PageSkeletons'

const moods = { 1: '😞', 2: '😔', 3: '😐', 4: '😊', 5: '😁' }
const moodDetails = {
  1: ['😞', 'Rough'],
  2: ['😔', 'Low'],
  3: ['😐', 'Okay'],
  4: ['😊', 'Good'],
  5: ['😁', 'Great'],
}

export default function FriendProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const profileQuery = useFriendProfileQuery(id)
  const profile = profileQuery.data
  const user = profile?.user
  const entries = profile?.entries || []
  const summary = profile?.summary || { entry_count: 0, dominant_mood: null, top_tag: null }
  const dominantMood = summary.dominant_mood ? moodDetails[summary.dominant_mood] : null

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-background pb-32 text-on-background">
      <header className="flex items-center justify-between px-container-margin py-md">
        <button
          type="button"
          aria-label="Go back"
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-full text-primary"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-headline-lg-mobile font-headline-lg-mobile text-on-surface">
          {user ? user.display_name || user.username : 'Friend Profile'}
        </h1>
        <div className="w-10" />
      </header>

      <div className="px-container-margin pt-sm space-y-8">
        {profileQuery.isLoading && <ProfileSkeleton />}

        {profileQuery.error && (
          <div className="rounded-[24px] bg-white p-lg cloud-shadow text-center space-y-md">
            <span className="material-symbols-outlined text-[48px] text-error">lock</span>
            <p role="alert" className="text-body-md text-on-surface">
              {profileQuery.error.status === 403
                ? 'You can only view profiles of accepted friends.'
                : profileQuery.error.message || 'Could not load friend profile.'}
            </p>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-full bg-primary px-lg py-sm text-label-lg text-on-primary"
            >
              Go back
            </button>
          </div>
        )}

        {user && (
          <>
            {/* Read-only User Header */}
            <section className="flex flex-col items-center">
              <div className="mb-md">
                <Avatar user={user} large />
              </div>
              <h2 className="text-headline-xl font-headline-xl text-on-surface">
                {user.display_name || user.username}
              </h2>
              <p className="text-body-md text-on-surface-variant">@{user.username}</p>
            </section>

            {/* Mood Summary Card */}
            <section className="grid grid-cols-2 gap-md" aria-labelledby="friend-summary-title">
              <div className="col-span-2 rounded-[24px] bg-surface-container-lowest p-lg cloud-shadow">
                <h2 id="friend-summary-title" className="text-headline-lg font-headline-lg text-on-surface">
                  Mood summary
                </h2>
                <div className="mt-sm flex items-baseline gap-xs">
                  <span className="text-headline-xl font-headline-xl text-on-surface">
                    {summary.entry_count}
                  </span>
                  <span className="text-body-md font-body-md text-on-surface-variant">
                    entries
                  </span>
                </div>
                <p className="mt-1 text-body-sm font-body-sm text-on-surface-variant">
                  Total moods logged this month
                </p>
              </div>
              <div className="flex min-h-[120px] flex-col justify-between rounded-[24px] bg-primary-container/30 p-lg">
                <span className="text-label-sm font-label-sm text-on-surface-variant">
                  Dominant mood
                </span>
                <div className="flex items-center gap-xs">
                  <span className="text-[28px]">{dominantMood?.[0] || '—'}</span>
                  <span className="text-headline-lg font-headline-lg text-on-surface">
                    {dominantMood?.[1] || 'None'}
                  </span>
                </div>
              </div>
              <div className="flex min-h-[120px] flex-col justify-between rounded-[24px] bg-secondary-container/30 p-lg">
                <span className="text-label-sm font-label-sm text-on-surface-variant">
                  Most used tag
                </span>
                <div className="flex items-center gap-xs">
                  <span className="material-symbols-outlined text-[28px] text-secondary">
                    auto_awesome
                  </span>
                  <span className="min-w-0 break-words text-headline-lg font-headline-lg text-on-surface">
                    {summary.top_tag || 'None'}
                  </span>
                </div>
              </div>
            </section>

            {/* Recent Entries */}
            <section>
              <div className="mb-md flex items-center justify-between">
                <h2 className="text-headline-lg font-headline-lg text-on-surface">Recent entries</h2>
                <Link to="/calendar" className="text-label-lg text-primary">
                  Calendar
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-md">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex min-h-[140px] flex-col justify-between rounded-[24px] bg-white p-lg cloud-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-label-sm text-on-surface-variant">
                        {formatDate(entry.date)}
                      </span>
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-container text-lg">
                        {moods[entry.mood] || '😐'}
                      </span>
                    </div>
                    {entry.photo_url && (
                      <div className="my-xs h-16 w-full overflow-hidden rounded-xl bg-surface-container-low">
                        <img src={entry.photo_url} alt="" className="h-full w-full object-cover" />
                      </div>
                    )}
                    <p className="line-clamp-2 text-body-sm text-on-surface">
                      {entry.text || entry.tags?.[0] || 'No note for this day.'}
                    </p>
                  </div>
                ))}
              </div>
              {entries.length === 0 && (
                <p className="rounded-[24px] bg-surface-container-low p-lg text-center text-body-sm text-on-surface-variant">
                  No public entries yet.
                </p>
              )}
            </section>
          </>
        )}
      </div>
      <BottomNav />
    </main>
  )
}

function Avatar({ user, large = false }) {
  const classes = large
    ? 'h-[112px] w-[112px] text-headline-lg border-4 border-surface-container-highest cloud-shadow'
    : 'h-10 w-10 text-body-md'
  const initials = (user.display_name || user.username)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  if (user.avatar_url) {
    return (
      <span className={`${classes} shrink-0 overflow-hidden rounded-full`}>
        <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
      </span>
    )
  }

  return (
    <span
      className={`flex ${classes} shrink-0 items-center justify-center rounded-full bg-secondary-container font-semibold text-secondary`}
    >
      {initials}
    </span>
  )
}

function formatDate(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}
