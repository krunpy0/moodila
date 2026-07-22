import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getEntry, saveEntry } from '../api/entries'
import { getLocalDate } from '../api/client'
import BottomNav from '../components/BottomNav'

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
  const date = params.get('date') || getLocalDate()
  const futureDate = date > getLocalDate()
  const [form, setForm] = useState({ date, mood: 0, tags: [], text: '' })
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (futureDate) {
      setStatus('Future entries are not available.')
      return
    }
    getEntry(date)
      .then(({ mood, tags, text }) => setForm({ date, mood, tags, text }))
      .catch((error) => {
        if (error.status !== 404) setStatus(error.message)
      })
  }, [date, futureDate])

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
      return
    }
    if (!form.mood) {
      setStatus('Choose a mood first.')
      return
    }
    setStatus('Saving...')
    try {
      const saved = await saveEntry(form)
      setForm({ date: saved.date, mood: saved.mood, tags: saved.tags, text: saved.text })
      setStatus('Entry saved.')
    } catch (error) {
      setStatus(error.message)
    }
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
          <div className="mt-lg flex items-center gap-md border-t border-surface-container pt-md">
            {[
              ['image', 'Add image'],
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
          disabled={futureDate || status === 'Saving...'}
          className="h-14 w-full rounded-full bg-primary text-label-lg font-label-lg text-on-primary disabled:opacity-60"
        >
          {status === 'Saving...' ? 'Saving...' : 'Save Entry'}
        </button>
      </form>

      <BottomNav />
    </div>
  )
}
