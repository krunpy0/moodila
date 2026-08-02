import { useParams, useNavigate, Link } from 'react-router-dom'
import { useFriendProfileQuery } from '../api/queries'
import BottomNav from '../components/BottomNav'
import { ProfileSkeleton } from '../components/skeleton/PageSkeletons'
import VoiceNotePlayer from '../components/VoiceNotePlayer'
import ImageWithSkeleton from '../components/ImageWithSkeleton'
import MoodIcon from '../components/MoodIcon'
import { getMoodInfo, getLocalizedTag } from '../utils/moods'
import { useLanguage } from '../context/LanguageContext'

export default function FriendProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, formatDate } = useLanguage()
  const profileQuery = useFriendProfileQuery(id)
  const profile = profileQuery.data
  const user = profile?.user
  const entries = profile?.entries || []
  const summary = profile?.summary || { entry_count: 0, dominant_mood: null, top_tag: null }
  const dominantMood = summary.dominant_mood ? getMoodInfo(summary.dominant_mood, t) : null

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-background pb-32 text-on-background">
      <header className="flex items-center justify-between px-container-margin py-md">
        <button
          type="button"
          aria-label={t('common.back')}
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-full text-primary"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-headline-lg-mobile font-headline-lg-mobile text-on-surface">
          {user ? user.display_name || user.username : t('profile.title')}
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
                ? t('common.error')
                : profileQuery.error.message || t('common.error')}
            </p>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-full bg-primary px-lg py-sm text-label-lg text-on-primary"
            >
              {t('common.back')}
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
                  {t('home.moodSummary')}
                </h2>
                <div className="mt-sm flex items-baseline gap-xs">
                  <span className="text-headline-xl font-headline-xl text-on-surface">
                    {summary.entry_count}
                  </span>
                  <span className="text-body-md font-body-md text-on-surface-variant">
                    {t('home.entries')}
                  </span>
                </div>
                <p className="mt-1 text-body-sm font-body-sm text-on-surface-variant">
                  {t('home.totalLoggedMonth')}
                </p>
              </div>
              <div className="flex min-h-[120px] flex-col justify-between rounded-[24px] bg-primary-container/30 p-lg">
                <span className="text-label-sm font-label-sm text-on-surface-variant">
                  {t('home.dominantMood')}
                </span>
                <div className="flex items-center gap-xs">
                  {dominantMood ? (
                    <MoodIcon mood={summary.dominant_mood} className="text-[32px]" />
                  ) : (
                    <span className="text-body-md text-on-surface-variant">—</span>
                  )}
                  <span className="text-headline-lg font-headline-lg text-on-surface">
                    {dominantMood ? dominantMood.label : t('common.none')}
                  </span>
                </div>
              </div>
              <div className="flex min-h-[120px] flex-col justify-between rounded-[24px] bg-secondary-container/30 p-lg">
                <span className="text-label-sm font-label-sm text-on-surface-variant">
                  {t('home.mostUsedTag')}
                </span>
                <div className="flex items-center gap-xs">
                  <span className="material-symbols-outlined text-[28px] text-secondary">
                    auto_awesome
                  </span>
                  <span className="min-w-0 break-words text-headline-lg font-headline-lg text-on-surface">
                    {summary.top_tag ? getLocalizedTag(summary.top_tag, t) : t('common.none')}
                  </span>
                </div>
              </div>
            </section>

            {/* Recent Entries */}
            <section>
              <div className="mb-md flex items-center justify-between">
                <h2 className="text-headline-lg font-headline-lg text-on-surface">{t('profile.recentEntries')}</h2>
                <Link to="/calendar" className="text-label-lg text-primary">
                  {t('nav.calendar')}
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
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full ${getMoodInfo(entry.mood, t).bg}`}>
                        <MoodIcon mood={entry.mood} className="text-[20px]" />
                      </span>
                    </div>
                    {entry.photo_url && (
                      <div className="my-xs">
                        <ImageWithSkeleton
                          src={entry.photo_url}
                          alt="Entry photo"
                          className="h-16 w-full object-cover rounded-xl"
                          containerClassName="rounded-xl"
                          skeletonHeightClass="h-16"
                        />
                      </div>
                    )}
                    {entry.audio_url && (
                      <div className="my-xs">
                        <VoiceNotePlayer audioUrl={entry.audio_url} duration={entry.audio_duration} />
                      </div>
                    )}
                    <p className="line-clamp-2 text-body-sm text-on-surface">
                      {entry.text || getLocalizedTag(entry.tags?.[0], t) || t('home.noNote')}
                    </p>
                  </div>
                ))}
              </div>
              {entries.length === 0 && (
                <p className="rounded-[24px] bg-surface-container-low p-lg text-center text-body-sm text-on-surface-variant">
                  {t('home.emptyRecent')}
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
    ? 'h-[112px] w-[112px] text-headline-lg cloud-shadow'
    : 'h-10 w-10 text-body-md'
  const initials = (user.display_name || user.username)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  if (user.avatar_url) {
    return (
      <span className={`inline-block ${classes} shrink-0 overflow-hidden rounded-full`}>
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
