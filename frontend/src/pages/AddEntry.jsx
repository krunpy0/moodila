import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getLocalDate } from '../api/client'
import { useEntryQuery, useSaveEntryMutation, useUpdateEntryVisibilityMutation } from '../api/queries'
import { uploadEntryPhoto } from '../api/entries'
import BottomNav from '../components/BottomNav'
import { useNotifications } from '../components/Notifications'

const moods = [
  ['sentiment_very_dissatisfied', 'text-error', 'bg-error-container/20'],
  ['sentiment_dissatisfied', 'text-tertiary', 'bg-tertiary-container/20'],
  ['sentiment_neutral', 'text-secondary', 'bg-secondary-container/20'],
  ['sentiment_satisfied', 'text-primary', 'bg-primary-container/20'],
  ['sentiment_very_satisfied', 'text-tertiary-fixed-dim', 'bg-tertiary-fixed/30'],
]
const availableTags = ['Calm', 'Chill', 'Motivated', 'Grateful', 'Inspired', 'Peaceful']

export default function AddEntry() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const date = params.get('date') || getLocalDate()
  const futureDate = date > getLocalDate()
  const [form, setForm] = useState({ date, mood: 0, tags: [], text: '', photo_url: null, is_hidden: false })
  const [status, setStatus] = useState('')
  const entryQuery = useEntryQuery(date, !futureDate)
  const saveMutation = useSaveEntryMutation()
  const visibilityMutation = useUpdateEntryVisibilityMutation()

  useEffect(() => {
    if (futureDate) {
      setStatus('Future entries are not available.')
      return
    }
    if (entryQuery.data) {
      const { mood, tags, text, photo_url: photoURL, is_hidden: isHidden } = entryQuery.data
      setForm({ date, mood, tags, text, photo_url: photoURL || null, is_hidden: Boolean(isHidden) })
      setStatus('')
    } else if (entryQuery.isError && entryQuery.error.status !== 404) {
      setStatus(entryQuery.error.message)
    } else if (!entryQuery.isLoading) {
      setForm({ date, mood: 0, tags: [], text: '', photo_url: null, is_hidden: false })
    }
  }, [date, futureDate, entryQuery.data, entryQuery.isError, entryQuery.isLoading, entryQuery.error])

  const toggleTag = (tag) =>
    setForm((current) => ({
      ...current,
      tags: current.tags.includes(tag)
        ? current.tags.filter((item) => item !== tag)
        : [...current.tags, tag],
    }))

  const submit = async (event) => {
    event.preventDefault()
    if (futureDate) {
      setStatus('Future entries are not available.')
      notify('Future entries are not available.', 'error')
      return
    }
    if (!form.mood) {
      setStatus('Choose a mood first.')
      notify('Choose a mood first.', 'error')
      return
    }
    saveMutation.mutate(form, {
      onSuccess: (saved) => {
        notify('Your entry has been saved.')
        navigate(`/calendar?month=${saved.date.slice(0, 7)}`, { replace: true })
      },
      onError: (error) => setStatus(error.message),
    })
  }

  const selectPhoto = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setStatus('Choose an image file.'); notify('Choose an image file.', 'error'); return }
    if (file.size > 10 * 1024 * 1024) { setStatus('Image must be 10 MB or smaller.'); notify('Image must be 10 MB or smaller.', 'error'); return }
    setStatus('Uploading photo...')
    try {
      const photoURL = await uploadEntryPhoto(file)
      setForm((current) => ({ ...current, photo_url: photoURL }))
      setStatus('Photo attached. Save your entry to publish it.')
      notify('Photo attached. Save your entry to publish it.')
    } catch (error) { setStatus(error.message); notify(error.message, 'error') }
  }

  return (
    <div className="min-h-screen bg-background text-on-surface pb-32">
      <header className="fixed top-0 z-40 flex w-full items-center justify-between bg-background/80 px-container-margin py-md backdrop-blur-md">
        <Link
          to="/"
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <h1 className="text-headline-lg-mobile font-headline-lg-mobile">Record your day</h1>
        <div className="w-10" />
      </header>

      <form onSubmit={submit} className="mx-auto mt-20 max-w-md space-y-lg px-container-margin">
        <section className="rounded-[24px] bg-white p-lg cloud-shadow">
          <h2 className="mb-md text-label-lg font-label-lg text-on-surface-variant">
            How are you feeling today?
          </h2>
          <div className="mb-lg flex items-center justify-between">
            {moods.map(([icon, color, background], index) => {
              const value = index + 1
              const selected = form.mood === value
              return (
                <button
                  key={icon}
                  type="button"
                  aria-label={`Mood ${value} of 5`}
                  aria-pressed={selected}
                  onClick={() => setForm((current) => ({ ...current, mood: value }))}
                  className={`flex h-12 w-12 items-center justify-center rounded-full ${background} ${
                    selected ? 'ring-4 ring-primary-container' : ''
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-[28px] ${color}`}
                    style={selected ? { fontVariationSettings: "'FILL' 1" } : undefined}
                  >
                    {icon}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="flex flex-wrap gap-xs">
            {availableTags.map((tag) => {
              const selected = form.tags.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleTag(tag)}
                  className={`rounded-full px-md py-xs text-label-sm font-label-sm ${
                    selected
                      ? 'bg-primary-container text-primary'
                      : 'bg-surface-container-low text-on-surface-variant'
                  }`}
                >
                  {tag}
                </button>
              )
            })}
          </div>
        </section>

        <section className="rounded-[24px] bg-white p-lg cloud-shadow">
          <label htmlFor="entry-text" className="mb-md block text-label-lg font-label-lg text-on-surface-variant">
            Write a summary of your day
          </label>
          <textarea
            id="entry-text"
            value={form.text}
            maxLength={5000}
            onChange={(event) => setForm((current) => ({ ...current, text: event.target.value }))}
            placeholder="Start writing..."
            className="min-h-[210px] w-full resize-none bg-transparent p-0 text-body-md font-body-md text-on-surface outline-none placeholder:text-on-surface-variant/40"
          />
          {form.photo_url && (
            <div className="relative mb-md overflow-hidden rounded-2xl bg-surface-container-low">
              <img src={form.photo_url} alt="Selected entry" className="max-h-64 w-full object-cover" />
              <button type="button" onClick={() => setForm((current) => ({ ...current, photo_url: null }))} aria-label="Remove photo" className="absolute right-sm top-sm flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-on-surface shadow-sm">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
          )}
          <div className="mt-lg flex items-center gap-md border-t border-surface-container pt-md">
            <label className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container">
              <span className="material-symbols-outlined text-[20px]">image</span>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={selectPhoto} className="sr-only" />
              <span className="sr-only">Add image</span>
            </label>
            {[
              ['mic', 'Record audio'],
              ['attach_file', 'Attach file'],
            ].map(([icon, label]) => (
              <button
                key={icon}
                type="button"
                disabled
                title={`${label} (coming later)`}
                aria-label={`${label} (coming later)`}
                className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant opacity-60"
              >
                <span className="material-symbols-outlined text-[20px]">{icon}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-between rounded-[24px] bg-white p-lg cloud-shadow">
          <div className="flex items-center gap-md">
            <span className="material-symbols-outlined text-[24px] text-on-surface-variant">
              {form.is_hidden ? 'lock' : 'public'}
            </span>
            <div>
              <span className="block text-body-md font-label-lg text-on-surface">
                Hide entry from friends
              </span>
              <span className="block text-body-sm text-on-surface-variant">
                {form.is_hidden ? 'Visible only to you' : 'Visible to friends'}
              </span>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.is_hidden}
            aria-label="Hide entry from friends"
            onClick={() => {
              const nextHidden = !form.is_hidden
              setForm((current) => ({ ...current, is_hidden: nextHidden }))
              if (entryQuery.data?.id) {
                visibilityMutation.mutate({ entryId: entryQuery.data.id, isHidden: nextHidden }, {
                  onSuccess: () => notify(nextHidden ? 'Entry hidden from friends' : 'Entry visible to friends'),
                  onError: (err) => notify(err.message, 'error'),
                })
              }
            }}
            className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full p-1 transition-colors duration-300 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              form.is_hidden ? 'bg-primary' : 'bg-surface-container-highest'
            }`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full bg-surface-container-lowest shadow-md transition-transform duration-300 ease-in-out ${
                form.is_hidden ? 'translate-x-6 text-on-primary-container' : 'translate-x-0 text-on-surface-variant'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {form.is_hidden ? 'lock' : 'public'}
              </span>
            </span>
          </button>
        </section>

        {status && (
          <p
            role="status"
            className={`text-center text-body-sm font-body-sm ${
              status === 'Entry saved.' ? 'text-primary' : 'text-error'
            }`}
          >
            {status}
          </p>
        )}
        <button
          type="submit"
          disabled={futureDate || saveMutation.isPending}
          className="h-14 w-full rounded-full bg-primary text-label-lg font-label-lg text-on-primary disabled:opacity-60"
        >
          {saveMutation.isPending ? 'Saving...' : 'Save Entry'}
        </button>
      </form>

      <BottomNav />
    </div>
  )
}
