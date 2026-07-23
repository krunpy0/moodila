import { useFeedQuery, useLikeEntryMutation } from '../api/queries'
import BottomNav from '../components/BottomNav'
import { FeedSkeleton } from '../components/skeleton/PageSkeletons'

const moods = {
  1: ['😞', 'Rough', 'bg-error-container/60 text-on-error-container'],
  2: ['😔', 'Low', 'bg-primary-container text-on-primary-container'],
  3: ['😐', 'Okay', 'bg-surface-container-highest text-on-surface-variant'],
  4: ['😊', 'Good', 'bg-secondary-container text-on-secondary-container'],
  5: ['😁', 'Great', 'bg-tertiary-container text-on-tertiary-container'],
}

export default function Feed() {
  const feedQuery = useFeedQuery()
  const likeMutation = useLikeEntryMutation()
  const entries = feedQuery.data || []

  const like = async (entryId) => {
    if (!likeMutation.isPending) likeMutation.mutate(entryId)
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-background pb-32 text-on-background">
      <header className="px-container-margin py-md">
        <p className="text-label-sm font-label-sm uppercase tracking-[0.12em] text-primary">Your circle</p>
        <h1 className="mt-xs text-headline-xl font-headline-xl text-on-surface">Friend feed</h1>
        <p className="mt-xs text-body-sm text-on-surface-variant">A gentle look at how everyone’s doing.</p>
      </header>

      <section className="space-y-md px-container-margin pt-sm" aria-live="polite">
        {feedQuery.isLoading ? <FeedSkeleton /> : <>
        {entries.map((entry) => <FeedCard key={entry.id} entry={entry} busy={likeMutation.isPending && likeMutation.variables === entry.id} onLike={like} />)}

        {!feedQuery.isLoading && !feedQuery.isError && entries.length === 0 && (
          <div className="rounded-[24px] bg-surface-container-low p-lg text-center">
            <span className="material-symbols-outlined text-[32px] text-primary">diversity_1</span>
            <h2 className="mt-sm text-body-md font-semibold text-on-surface">Your feed is quiet</h2>
            <p className="mt-xs text-body-sm text-on-surface-variant">Friends’ visible journal entries will appear here.</p>
          </div>
        )}

        </>}
        {feedQuery.isError && <p role="alert" className="py-lg text-center text-body-sm text-error">{feedQuery.error.message}</p>}
        {likeMutation.isError && <p role="alert" className="py-lg text-center text-body-sm text-error">{likeMutation.error.message}</p>}
      </section>
      <BottomNav />
    </main>
  )
}

function FeedCard({ entry, busy, onLike }) {
  const [emoji, moodName, moodClass] = moods[entry.mood] || moods[3]
  const authorName = entry.author.display_name || entry.author.username
  return (
    <article className="rounded-[24px] bg-surface-container-lowest p-lg cloud-shadow">
      <header className="flex items-center gap-sm">
        <Avatar author={entry.author} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-body-md font-semibold text-on-surface">{authorName}</h2>
          <p className="text-label-sm text-on-surface-variant">@{entry.author.username} · {relativeDate(entry.date)}</p>
        </div>
        <span className={`flex h-11 w-11 items-center justify-center rounded-full text-xl ${moodClass}`} title={moodName}>{emoji}</span>
      </header>

      <div className="mt-md space-y-sm">
        <div className="flex flex-wrap gap-xs">
          <span className={`rounded-full px-sm py-xs text-label-sm font-label-sm ${moodClass}`}>{moodName}</span>
          {entry.tags.map((tag) => <span key={tag} className="rounded-full bg-surface-container-low px-sm py-xs text-label-sm text-on-surface-variant">{tag}</span>)}
        </div>
        <p className="whitespace-pre-wrap text-body-md leading-6 text-on-surface">{entry.text || 'No note for this day.'}</p>
        {entry.photo_url && <img src={entry.photo_url} alt={`Photo from ${authorName}'s day`} className="max-h-96 w-full rounded-2xl object-cover" loading="lazy" />}
      </div>

      <footer className="mt-md flex items-center border-t border-surface-container pt-sm">
        <button
          type="button"
          onClick={() => onLike(entry.id)}
          disabled={busy || entry.liked_by_me}
          aria-label={entry.liked_by_me ? 'Liked' : 'Like this entry'}
          className={`flex items-center gap-xs rounded-full px-sm py-xs text-label-sm font-label-sm transition-colors disabled:opacity-70 ${entry.liked_by_me ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-low text-on-surface-variant'}`}
        >
          <span className="material-symbols-outlined text-[19px]" style={entry.liked_by_me ? { fontVariationSettings: "'FILL' 1" } : undefined}>favorite</span>
          {entry.like_count || 0} {entry.like_count === 1 ? 'like' : 'likes'}
        </button>
      </footer>
    </article>
  )
}

function Avatar({ author }) {
  if (author.avatar_url) return <img src={author.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
  const initials = (author.display_name || author.username).split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  return <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary-container text-label-lg text-secondary">{initials}</span>
}

function relativeDate(value) {
  const date = new Date(`${value}T12:00:00`)
  const today = new Date()
  const todayKey = today.toISOString().slice(0, 10)
  if (value === todayKey) return 'Today'
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  if (value === yesterday.toISOString().slice(0, 10)) return 'Yesterday'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
