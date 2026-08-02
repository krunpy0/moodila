import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useInfiniteFeedQuery,
  useLikeEntryMutation,
  useCommentsQuery,
  useAddCommentMutation,
  useDeleteCommentMutation,
  useProfileQuery,
  useFriendsQuery,
} from '../api/queries'
import AppLayout from '../components/AppLayout'
import BottomNav from '../components/BottomNav'
import HeaderBell from '../components/HeaderBell'
import { FeedSkeleton } from '../components/skeleton/PageSkeletons'
import VoiceNotePlayer from '../components/VoiceNotePlayer'
import ImageWithSkeleton from '../components/ImageWithSkeleton'
import MoodIcon from '../components/MoodIcon'
import { getMoodInfo, getLocalizedTag } from '../utils/moods'
import { useLanguage } from '../context/LanguageContext'
import { getLocalDate } from '../api/client'

const emojiReactions = ['❤️', '🫂', '👏', '💡', '😁']

export default function Feed() {
  const [includeSelf, setIncludeSelf] = useState(() => {
    try {
      return localStorage.getItem('moodshare_feed_include_self') === 'true'
    } catch {
      return false
    }
  })

  const feedQuery = useInfiniteFeedQuery(10, includeSelf)
  const friendsQuery = useFriendsQuery()
  const likeMutation = useLikeEntryMutation()
  const observerRef = useRef(null)
  const { t, language } = useLanguage()

  const friends = friendsQuery.data || []

  const handleToggleIncludeSelf = () => {
    setIncludeSelf((prev) => {
      const next = !prev
      try {
        localStorage.setItem('moodshare_feed_include_self', String(next))
      } catch {
        // Storage restriction fallback
      }
      return next
    })
  }

  const entries = feedQuery.data
    ? feedQuery.data.pages.flatMap((page) => page.items || page.entries || [])
    : []

  const fetchNextPage = feedQuery.fetchNextPage
  const hasNextPage = feedQuery.hasNextPage
  const isFetchingNextPage = feedQuery.isFetchingNextPage

  const fetchNextPageRef = useRef(fetchNextPage)
  const canFetchRef = useRef(!isFetchingNextPage && hasNextPage)

  useEffect(() => {
    fetchNextPageRef.current = fetchNextPage
    canFetchRef.current = Boolean(!isFetchingNextPage && hasNextPage)
  })

  useEffect(() => {
    const target = observerRef.current
    if (!target || !hasNextPage) return

    let debounceTimer = null

    const observer = new IntersectionObserver(
      (observerEntries) => {
        if (observerEntries[0]?.isIntersecting && canFetchRef.current) {
          if (debounceTimer) clearTimeout(debounceTimer)
          debounceTimer = setTimeout(() => {
            if (canFetchRef.current) {
              fetchNextPageRef.current()
            }
          }, 200)
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(target)
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      observer.disconnect()
    }
  }, [hasNextPage])

  const handleReact = (entryId, reaction) => {
    if (!likeMutation.isPending) {
      likeMutation.mutate({ entryId, reaction })
    }
  }

  return (
    <AppLayout>
      <main className="mx-auto min-h-screen w-full max-w-md lg:max-w-6xl xl:max-w-7xl bg-background pb-32 lg:pb-12 text-on-background px-0 lg:px-6 py-0 lg:py-6">
        <header className="flex items-center justify-between px-container-margin py-md lg:px-0">
          <div>
            <p className="text-label-sm font-label-sm uppercase tracking-[0.12em] text-primary">{t('feed.title')}</p>
            <h1 className="mt-xs text-headline-xl font-headline-xl text-on-surface">{t('feed.title')}</h1>
            <p className="mt-xs text-body-sm text-on-surface-variant">{t('feed.emptySubtitle')}</p>
          </div>
          <div className="lg:hidden">
            <HeaderBell />
          </div>
        </header>

        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
          {/* Main Feed Column */}
          <div className="lg:col-span-8 space-y-md">
            <section className="px-container-margin lg:px-0 pb-xs">
              <div className="flex items-center justify-between rounded-[20px] bg-surface-container-lowest p-md cloud-shadow border border-outline-variant/15">
                <div className="flex items-center gap-sm">
                  <span className="material-symbols-outlined text-[22px] text-primary">
                    {includeSelf ? 'person' : 'group'}
                  </span>
                  <div>
                    <span className="block text-body-sm font-semibold text-on-surface">
                      {t('feed.includeMyPosts')}
                    </span>
                    <span className="block text-label-sm text-on-surface-variant">
                      {t('feed.includeMyPostsDesc')}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={includeSelf}
                  aria-label={t('feed.includeMyPosts')}
                  onClick={handleToggleIncludeSelf}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-300 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    includeSelf ? 'bg-primary' : 'bg-surface-container-highest'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full bg-surface-container-lowest shadow-md transition-transform duration-300 ease-in-out ${
                      includeSelf ? 'translate-x-5 text-on-primary-container' : 'translate-x-0 text-on-surface-variant'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {includeSelf ? 'check' : 'close'}
                    </span>
                  </span>
                </button>
              </div>
            </section>

            <section className="space-y-md px-container-margin lg:px-0 pt-sm" aria-live="polite">
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

                  {hasNextPage && (
                    <div ref={observerRef} className="py-md text-center">
                      <p className="text-body-sm text-on-surface-variant">
                        {isFetchingNextPage ? t('common.loading') : t('common.seeMore')}
                      </p>
                    </div>
                  )}

                  {!feedQuery.isLoading && !feedQuery.isError && entries.length === 0 && (
                    <div className="rounded-[24px] bg-surface-container-low p-lg text-center border border-outline-variant/15">
                      <span className="material-symbols-outlined text-[32px] text-primary">diversity_1</span>
                      <h2 className="mt-sm text-body-md font-semibold text-on-surface">{t('feed.emptyTitle')}</h2>
                      <p className="mt-xs text-body-sm text-on-surface-variant">{t('feed.emptySubtitle')}</p>
                      <Link to="/friends" className="mt-md inline-block rounded-full bg-primary px-lg py-sm text-label-lg font-semibold text-on-primary">
                        {t('feed.addFriendsBtn')}
                      </Link>
                    </div>
                  )}
                </>
              )}
              {feedQuery.isError && <p role="alert" className="py-lg text-center text-body-sm text-error">{feedQuery.error.message}</p>}
              {likeMutation.isError && <p role="alert" className="py-lg text-center text-body-sm text-error">{likeMutation.error.message}</p>}
            </section>
          </div>

          {/* Right Sidebar Column on Desktop */}
          <div className="hidden lg:block lg:col-span-4 space-y-md">
            <div className="sticky top-6 rounded-[24px] bg-surface-container-lowest p-lg cloud-shadow space-y-md border border-outline-variant/15">
              <div className="flex items-center justify-between border-b border-outline-variant/15 pb-sm">
                <h3 className="text-headline-lg font-bold text-on-surface">
                  {language === 'ru' ? 'Друзья' : 'Friends'}
                </h3>
                <Link
                  to="/friends"
                  className="text-label-sm font-semibold text-primary hover:underline"
                >
                  {t('common.seeAll')}
                </Link>
              </div>

              {friends.length > 0 ? (
                <div className="space-y-sm">
                  {friends.slice(0, 5).map((friend) => (
                    <Link
                      key={friend.id}
                      to={`/calendar?friend=${friend.id}`}
                      className="flex items-center justify-between p-2.5 rounded-2xl bg-surface-container-low hover:bg-surface-container transition-colors group"
                    >
                      <div className="flex items-center gap-sm min-w-0">
                        {friend.avatar_url ? (
                          <img
                            src={friend.avatar_url}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-primary/20"
                          />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-container font-semibold text-secondary text-body-sm">
                            {(friend.display_name || friend.username)[0].toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-body-sm font-semibold text-on-surface truncate">
                            {friend.display_name || friend.username}
                          </p>
                          <p className="text-label-sm text-on-surface-variant truncate">
                            @{friend.username}
                          </p>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-[18px] text-on-surface-variant/40 group-hover:text-primary transition-colors">
                        calendar_month
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-4 text-center">
                  <p className="text-body-sm text-on-surface-variant">
                    {language === 'ru' ? 'У вас пока нет друзей' : 'No friends added yet'}
                  </p>
                  <Link
                    to="/friends"
                    className="mt-xs inline-block text-label-sm font-semibold text-primary hover:underline"
                  >
                    {language === 'ru' ? 'Найти друзей' : 'Find friends'}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
        <BottomNav />
      </main>
    </AppLayout>
  )
}

const moodTintBg = {
  1: 'bg-error-container/30',
  2: 'bg-primary-container/40',
  3: 'bg-surface-container-high/50',
  4: 'bg-secondary-container/40',
  5: 'bg-tertiary-container/40',
}

function FeedCard({ entry, busy, onReact }) {
  const [showComments, setShowComments] = useState(false)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const { t, dateLocale } = useLanguage()
  const moodInfo = getMoodInfo(entry.mood, t)
  const authorName = entry.author.display_name || entry.author.username

  const hasText = !!entry.text
  const hasPhoto = !!entry.photo_url
  const hasAudio = !!entry.audio_url
  const hasTags = entry.tags && entry.tags.length > 0
  const isMoodOnly = !hasText && !hasPhoto && !hasAudio

  if (isMoodOnly) {
    return (
      <article className={`rounded-[24px] p-lg cloud-shadow ${moodTintBg[entry.mood] || 'bg-surface-container-high/50'}`}>
        <header className="flex items-center gap-sm">
          <Link to={`/profile/${entry.author.id}`} className="flex min-w-0 flex-1 items-center gap-sm transition-opacity hover:opacity-80">
            <Avatar author={entry.author} />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-body-md font-semibold text-on-surface">{authorName}</h2>
              <p className="text-label-sm text-on-surface-variant">@{entry.author.username} · {formatFeedDate(entry.created_at, entry.date, t, dateLocale)}</p>
            </div>
          </Link>
        </header>

        <div className="mt-md flex flex-col items-center gap-sm py-sm">
          <span className={`flex h-16 w-16 items-center justify-center rounded-full ${moodInfo.bg}`}>
            <MoodIcon mood={entry.mood} className="text-[36px]" />
          </span>
          <span className={`rounded-full px-md py-xs text-label-lg font-label-lg ${moodInfo.bg} ${moodInfo.color}`}>{moodInfo.label}</span>
          {hasTags && (
            <div className="mt-xs flex flex-wrap justify-center gap-xs">
              {entry.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-surface-container-lowest/60 px-sm py-xs text-label-sm text-on-surface-variant">{getLocalizedTag(tag, t)}</span>
              ))}
            </div>
          )}
        </div>

        <footer className="relative mt-sm border-t border-on-surface/5 pt-sm">
          {emojiPickerOpen && (
            <div className="absolute -top-12 left-0 z-20 flex items-center gap-xs rounded-full bg-surface-container-high p-1 shadow-lg ring-1 ring-black/5 animate-in fade-in zoom-in-95">
              {emojiReactions.map((reac) => (
                <button
                  key={reac}
                  type="button"
                  onClick={() => { onReact(entry.id, reac); setEmojiPickerOpen(false) }}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-xl transition-transform hover:scale-125 active:scale-95"
                >{reac}</button>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setEmojiPickerOpen((prev) => !prev)}
              disabled={busy}
              aria-label="Select reaction"
              className={`flex items-center gap-xs rounded-full px-sm py-xs text-label-sm font-label-sm transition-colors disabled:opacity-70 ${
                entry.liked_by_me ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-lowest/60 text-on-surface-variant'
              }`}
            >
              <span className="text-[16px]">{entry.my_reaction || '❤️'}</span>
              <span>{entry.like_count || 0}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowComments((prev) => !prev)}
              className="flex items-center gap-xs rounded-full bg-surface-container-lowest/60 px-sm py-xs text-label-sm text-on-surface-variant transition-colors hover:bg-surface-container-lowest"
            >
              <span className="material-symbols-outlined text-[19px]">chat_bubble</span>
              <span>{t('feed.commentsCount', { count: entry.comment_count || 0 })}</span>
            </button>
          </div>
        </footer>

        {showComments && <CommentsSection entryId={entry.id} />}
      </article>
    )
  }

  return (
    <article className="rounded-[24px] bg-surface-container-lowest p-lg cloud-shadow">
      <header className="flex items-center gap-sm">
        <Link to={`/profile/${entry.author.id}`} className="flex min-w-0 flex-1 items-center gap-sm transition-opacity hover:opacity-80">
          <Avatar author={entry.author} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-body-md font-semibold text-on-surface">{authorName}</h2>
            <p className="text-label-sm text-on-surface-variant">@{entry.author.username} · {formatFeedDate(entry.created_at, entry.date, t, dateLocale)}</p>
          </div>
        </Link>
        <span className={`flex h-11 w-11 items-center justify-center rounded-full ${moodInfo.bg}`} title={moodInfo.label}>
          <MoodIcon mood={entry.mood} className="text-[24px]" />
        </span>
      </header>

      <div className="mt-md space-y-sm">
        <div className="flex flex-wrap gap-xs">
          <span className={`rounded-full px-sm py-xs text-label-sm font-label-sm ${moodInfo.bg} ${moodInfo.color}`}>{moodInfo.label}</span>
          {entry.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-surface-container-low px-sm py-xs text-label-sm text-on-surface-variant">{getLocalizedTag(tag, t)}</span>
          ))}
        </div>
        {hasText && (
          <p className="whitespace-pre-wrap text-body-md leading-6 text-on-surface">{entry.text}</p>
        )}
        {hasPhoto && (
          <ImageWithSkeleton
            src={entry.photo_url}
            alt={`Photo from ${authorName}'s day`}
            className="w-full h-auto rounded-2xl object-contain"
            skeletonHeightClass="h-64 sm:h-80"
            loading="lazy"
          />
        )}
        {hasAudio && (
          <VoiceNotePlayer audioUrl={entry.audio_url} duration={entry.audio_duration} className="mt-sm" />
        )}
      </div>

      <footer className="relative mt-md border-t border-surface-container pt-sm">
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
            <span>{t('feed.commentsCount', { count: entry.comment_count || 0 })}</span>
          </button>
        </div>
      </footer>

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
  const { t, dateLocale } = useLanguage()
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
      deleteMutation.mutate({ commentId, entryId })
    }
  }

  return (
    <div className="mt-md border-t border-surface-container-low pt-md">
      {commentsQuery.isLoading ? (
        <p className="py-sm text-center text-body-sm text-on-surface-variant">{t('common.loading')}</p>
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
                    <span className="text-label-sm text-on-surface-variant/60">{formatFeedDate(comment.created_at, null, t, dateLocale)}</span>
                  </div>
                  <p className="mt-xs whitespace-pre-wrap text-body-sm text-on-surface">{comment.text}</p>
                </div>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => handleDelete(comment.id)}
                    aria-label={t('common.delete')}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant/40 hover:bg-error-container/20 hover:text-error"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                )}
              </div>
            )
          })}

          {comments.length === 0 && (
            <p className="py-xs text-center text-body-sm text-on-surface-variant/70">{t('feed.addComment')}</p>
          )}
        </div>
      )}

      <form onSubmit={handleSend} className="mt-md flex items-center gap-xs">
        <input
          type="text"
          value={commentText}
          maxLength={500}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder={t('feed.addComment')}
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

function parseISO(str) {
  if (!str) return null
  let s = String(str).trim()
  if (!s.includes('T')) s = s.replace(' ', 'T')
  s = s.replace(/([+-]\d{2})$/, '$1:00')
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

function getYesterdayDate() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

function formatFeedDate(createdAt, fallbackDate, t, dateLocale) {
  if (!createdAt && !fallbackDate) return ''

  const createdDate = parseISO(createdAt)
  let timeStr = ''
  if (createdDate) {
    const hours = String(createdDate.getHours()).padStart(2, '0')
    const minutes = String(createdDate.getMinutes()).padStart(2, '0')
    timeStr = `${hours}:${minutes}`
  }

  let dateKey = ''
  if (fallbackDate && typeof fallbackDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fallbackDate)) {
    dateKey = fallbackDate
  } else if (createdDate) {
    dateKey = [
      createdDate.getFullYear(),
      String(createdDate.getMonth() + 1).padStart(2, '0'),
      String(createdDate.getDate()).padStart(2, '0'),
    ].join('-')
  }

  if (!dateKey) return fallbackDate || createdAt || ''

  const todayStr = getLocalDate()
  const yesterdayStr = getYesterdayDate()

  let dateStr = ''
  if (dateKey === todayStr) {
    dateStr = t ? t('common.today') : 'Today'
  } else if (dateKey === yesterdayStr) {
    dateStr = t ? t('common.yesterday') : 'Yesterday'
  } else {
    const [y, m, d] = dateKey.split('-').map(Number)
    const localObj = new Date(y, m - 1, d)
    const locale = dateLocale || (t && t('common.today') === 'Сегодня' ? 'ru-RU' : 'en-US')
    dateStr = localObj.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
  }

  return timeStr ? `${dateStr}, ${timeStr}` : dateStr
}
