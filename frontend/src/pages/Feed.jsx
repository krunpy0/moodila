import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useFeedQuery,
  useLikeEntryMutation,
  useCommentsQuery,
  useAddCommentMutation,
  useDeleteCommentMutation,
  useProfileQuery,
} from '../api/queries'
import BottomNav from '../components/BottomNav'
import HeaderBell from '../components/HeaderBell'
import { FeedSkeleton } from '../components/skeleton/PageSkeletons'

const moods = {
  1: ['😞', 'Rough', 'bg-error-container/60 text-on-error-container'],
  2: ['😔', 'Low', 'bg-primary-container text-on-primary-container'],
  3: ['😐', 'Okay', 'bg-surface-container-highest text-on-surface-variant'],
  4: ['😊', 'Good', 'bg-secondary-container text-on-secondary-container'],
  5: ['😁', 'Great', 'bg-tertiary-container text-on-tertiary-container'],
}

const emojiReactions = ['❤️', '🫂', '👏', '💡', '😁']

export default function Feed() {
  const feedQuery = useFeedQuery()
  const likeMutation = useLikeEntryMutation()
  const entries = feedQuery.data || []

  const handleReact = (entryId, reaction) => {
    if (!likeMutation.isPending) {
      likeMutation.mutate({ entryId, reaction })
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-background pb-32 text-on-background">
      <header className="flex items-center justify-between px-container-margin py-md">
        <div>
          <p className="text-label-sm font-label-sm uppercase tracking-[0.12em] text-primary">Your circle</p>
          <h1 className="mt-xs text-headline-xl font-headline-xl text-on-surface">Friend feed</h1>
          <p className="mt-xs text-body-sm text-on-surface-variant">A gentle look at how everyone’s doing.</p>
        </div>
        <HeaderBell />
      </header>

      <section className="space-y-md px-container-margin pt-sm" aria-live="polite">
        {feedQuery.isLoading ? (
          <FeedSkeleton />
        ) : (
          <>
            {entries.map((entry) => (
              <FeedCard
                key={entry.id}
                entry={entry}
                busy={likeMutation.isPending && likeMutation.variables?.entryId === entry.id}
                onReact={handleReact}
              />
            ))}

            {!feedQuery.isLoading && !feedQuery.isError && entries.length === 0 && (
              <div className="rounded-[24px] bg-surface-container-low p-lg text-center">
                <span className="material-symbols-outlined text-[32px] text-primary">diversity_1</span>
                <h2 className="mt-sm text-body-md font-semibold text-on-surface">Your feed is quiet</h2>
                <p className="mt-xs text-body-sm text-on-surface-variant">Friends’ visible journal entries will appear here.</p>
              </div>
            )}
          </>
        )}
        {feedQuery.isError && <p role="alert" className="py-lg text-center text-body-sm text-error">{feedQuery.error.message}</p>}
        {likeMutation.isError && <p role="alert" className="py-lg text-center text-body-sm text-error">{likeMutation.error.message}</p>}
      </section>
      <BottomNav />
    </main>
  )
}

function FeedCard({ entry, busy, onReact }) {
  const [showComments, setShowComments] = useState(false)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const [emoji, moodName, moodClass] = moods[entry.mood] || moods[3]
  const authorName = entry.author.display_name || entry.author.username

  return (
    <article className="rounded-[24px] bg-surface-container-lowest p-lg cloud-shadow">
      <header className="flex items-center gap-sm">
        <Link to={`/profile/${entry.author.id}`} className="flex min-w-0 flex-1 items-center gap-sm transition-opacity hover:opacity-80">
          <Avatar author={entry.author} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-body-md font-semibold text-on-surface">{authorName}</h2>
            <p className="text-label-sm text-on-surface-variant">@{entry.author.username} · {relativeDate(entry.date)}</p>
          </div>
        </Link>
        <span className={`flex h-11 w-11 items-center justify-center rounded-full text-xl ${moodClass}`} title={moodName}>{emoji}</span>
      </header>

      <div className="mt-md space-y-sm">
        <div className="flex flex-wrap gap-xs">
          <span className={`rounded-full px-sm py-xs text-label-sm font-label-sm ${moodClass}`}>{moodName}</span>
          {entry.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-surface-container-low px-sm py-xs text-label-sm text-on-surface-variant">{tag}</span>
          ))}
        </div>
        <p className="whitespace-pre-wrap text-body-md leading-6 text-on-surface">{entry.text || 'No note for this day.'}</p>
        {entry.photo_url && (
          <img src={entry.photo_url} alt={`Photo from ${authorName}'s day`} className="max-h-96 w-full rounded-2xl object-cover" loading="lazy" />
        )}
      </div>

      <footer className="relative mt-md border-t border-surface-container pt-sm">
        {/* Emoji picker popup */}
        {emojiPickerOpen && (
          <div className="absolute -top-12 left-0 z-20 flex items-center gap-xs rounded-full bg-surface-container-high p-1 shadow-lg ring-1 ring-black/5 animate-in fade-in zoom-in-95">
            {emojiReactions.map((reac) => (
              <button
                key={reac}
                type="button"
                onClick={() => {
                  onReact(entry.id, reac)
                  setEmojiPickerOpen(false)
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full text-xl transition-transform hover:scale-125 active:scale-95"
              >
                {reac}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-xs">
            <button
              type="button"
              onClick={() => setEmojiPickerOpen((prev) => !prev)}
              disabled={busy}
              aria-label="Select reaction"
              className={`flex items-center gap-xs rounded-full px-sm py-xs text-label-sm font-label-sm transition-colors disabled:opacity-70 ${
                entry.liked_by_me ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-low text-on-surface-variant'
              }`}
            >
              <span className="text-[16px]">
                {entry.my_reaction || '❤️'}
              </span>
              <span>{entry.like_count || 0}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowComments((prev) => !prev)}
            className="flex items-center gap-xs rounded-full bg-surface-container-low px-sm py-xs text-label-sm text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[19px]">chat_bubble</span>
            <span>{entry.comment_count || 0} {entry.comment_count === 1 ? 'comment' : 'comments'}</span>
          </button>
        </div>
      </footer>

      {/* Expandable Comments Drawer */}
      {showComments && <CommentsSection entryId={entry.id} />}
    </article>
  )
}

function CommentsSection({ entryId }) {
  const [commentText, setCommentText] = useState('')
  const commentsQuery = useCommentsQuery(entryId)
  const addMutation = useAddCommentMutation()
  const deleteMutation = useDeleteCommentMutation()
  const profileQuery = useProfileQuery()
  const currentUserId = profileQuery.data?.user?.id
  const comments = commentsQuery.data || []

  const handleSend = (e) => {
    e.preventDefault()
    const trimmed = commentText.trim()
    if (!trimmed || addMutation.isPending) return
    addMutation.mutate(
      { entryId, text: trimmed },
      {
        onSuccess: () => setCommentText(''),
      }
    )
  }

  const handleDelete = (commentId) => {
    if (!deleteMutation.isPending) {
      deleteMutation.mutate(commentId)
    }
  }

  return (
    <div className="mt-md border-t border-surface-container-low pt-md">
      {commentsQuery.isLoading ? (
        <p className="py-sm text-center text-body-sm text-on-surface-variant">Loading comments...</p>
      ) : (
        <div className="space-y-md">
          {comments.map((comment) => {
            const isOwner = currentUserId && comment.user_id === currentUserId
            const commentAuthor = comment.author.display_name || comment.author.username
            return (
              <div key={comment.id} className="flex items-start gap-sm">
                <Avatar author={comment.author} small />
                <div className="min-w-0 flex-1 rounded-2xl bg-surface-container-low p-sm">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-label-sm font-semibold text-on-surface">{commentAuthor}</span>
                    <span className="text-label-sm text-on-surface-variant/60">{relativeDate(comment.created_at?.slice(0, 10))}</span>
                  </div>
                  <p className="mt-xs whitespace-pre-wrap text-body-sm text-on-surface">{comment.text}</p>
                </div>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => handleDelete(comment.id)}
                    aria-label="Delete comment"
                    className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant/40 hover:bg-error-container/20 hover:text-error"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                )}
              </div>
            )
          })}

          {comments.length === 0 && (
            <p className="py-xs text-center text-body-sm text-on-surface-variant/70">No comments yet. Be the first to reply!</p>
          )}
        </div>
      )}

      {/* Add comment form */}
      <form onSubmit={handleSend} className="mt-md flex items-center gap-xs">
        <input
          type="text"
          value={commentText}
          maxLength={500}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Write a comment..."
          className="flex-1 rounded-full bg-surface-container-low px-md py-xs text-body-sm text-on-surface outline-none placeholder:text-on-surface-variant/50 focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="submit"
          disabled={!commentText.trim() || addMutation.isPending}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-on-primary disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-[18px]">send</span>
        </button>
      </form>
    </div>
  )
}

function Avatar({ author, small = false }) {
  const sizeClass = small ? 'h-8 w-8 text-label-sm' : 'h-12 w-12 text-label-lg'
  if (author.avatar_url) return <img src={author.avatar_url} alt="" className={`${sizeClass} rounded-full object-cover`} />
  const initials = (author.display_name || author.username).split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  return <span className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full bg-secondary-container font-semibold text-secondary`}>{initials}</span>
}

function relativeDate(value) {
  if (!value) return ''
  const date = new Date(`${value}T12:00:00`)
  const today = new Date()
  const todayKey = today.toISOString().slice(0, 10)
  if (value === todayKey) return 'Today'
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  if (value === yesterday.toISOString().slice(0, 10)) return 'Yesterday'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
