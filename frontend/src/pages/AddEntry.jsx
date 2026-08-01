import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getLocalDate } from '../api/client'
import { useDeleteEntryMutation, useEntryQuery, useSaveEntryMutation, useUpdateEntryVisibilityMutation } from '../api/queries'
import { uploadEntryPhoto, uploadEntryAudio } from '../api/entries'
import BottomNav from '../components/BottomNav'
import { useNotifications } from '../components/Notifications'
import VoiceNotePlayer from '../components/VoiceNotePlayer'
import ImageWithSkeleton from '../components/ImageWithSkeleton'
import MoodIcon from '../components/MoodIcon'
import { MOODS, TAG_CATEGORIES } from '../utils/moods'

export default function AddEntry() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const date = params.get('date') || getLocalDate()
  const futureDate = date > getLocalDate()
  const [form, setForm] = useState({ date, mood: 0, tags: [], text: '', photo_url: null, audio_url: null, audio_duration: null, is_hidden: false })
  const [status, setStatus] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const entryQuery = useEntryQuery(date, !futureDate)
  const saveMutation = useSaveEntryMutation()
  const visibilityMutation = useUpdateEntryVisibilityMutation()
  const deleteMutation = useDeleteEntryMutation()

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [isRecording, setIsRecording] = useState(false)

  const selectPhoto = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setStatus('Choose an image file.'); notify('Choose an image file.', 'error'); return }
    if (file.size > 10 * 1024 * 1024) { setStatus('Image must be 10 MB or smaller.'); notify('Image must be 10 MB or smaller.', 'error'); return }
    setStatus('Uploading photo...')
    setIsUploadingPhoto(true)
    try {
      const photoURL = await uploadEntryPhoto(file)
      setForm((current) => ({ ...current, photo_url: photoURL }))
      setStatus('Photo attached. Save your entry to publish it.')
      notify('Photo attached. Save your entry to publish it.')
    } catch (error) {
      setStatus(error.message)
      notify(error.message, 'error')
    } finally {
      setIsUploadingPhoto(false)
    }
  }
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState(null)
  const [audioDuration, setAudioDuration] = useState(null)
  const mediaRecorderRef = useRef(null)
  const recordingTimerRef = useRef(null)
  const audioChunksRef = useRef([])

  useEffect(() => {
    if (futureDate) {
      setStatus('Future entries are not available.')
      return
    }
    if (entryQuery.data) {
      const { mood, tags, text, photo_url: photoURL, audio_url: audioURL, audio_duration: audioDur, is_hidden: isHidden } = entryQuery.data
      setForm({ date, mood, tags, text, photo_url: photoURL || null, audio_url: audioURL || null, audio_duration: audioDur || null, is_hidden: Boolean(isHidden) })
      setAudioDuration(audioDur || null)
      setStatus('')
    } else if (entryQuery.isError && entryQuery.error.status !== 404) {
      setStatus(entryQuery.error.message)
    } else if (!entryQuery.isLoading) {
      setForm({ date, mood: 0, tags: [], text: '', photo_url: null, audio_url: null, audio_duration: null, is_hidden: false })
    }
  }, [date, futureDate, entryQuery.data, entryQuery.isError, entryQuery.isLoading, entryQuery.error])

  const toggleTag = (tag) =>
    setForm((current) => ({
      ...current,
      tags: current.tags.includes(tag)
        ? current.tags.filter((item) => item !== tag)
        : [...current.tags, tag],
    }))

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      notify('Microphone access is not supported in your browser.', 'error')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunksRef.current = []
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        setAudioBlob(blob)
        clearInterval(recordingTimerRef.current)
        setIsRecording(false)
      }

      recorder.start(100)
      setIsRecording(true)
      setRecordingTime(0)

      const startTime = Date.now()
      recordingTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000)
        setRecordingTime(elapsed)
        setAudioDuration(elapsed)
        if (elapsed >= 30) {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop()
          }
          clearInterval(recordingTimerRef.current)
          setIsRecording(false)
        }
      }, 200)
    } catch (err) {
      console.error('Microphone error:', err)
      notify('Could not access microphone.', 'error')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    clearInterval(recordingTimerRef.current)
    setIsRecording(false)
  }

  const clearAudio = () => {
    setAudioBlob(null)
    setAudioDuration(null)
    setForm((current) => ({ ...current, audio_url: null, audio_duration: null }))
  }

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

    let payload = { ...form }

    if (audioBlob) {
      setStatus('Uploading voice note...')
      try {
        const uploadedAudioUrl = await uploadEntryAudio(audioBlob)
        payload.audio_url = uploadedAudioUrl
        payload.audio_duration = audioDuration || 1
      } catch (err) {
        setStatus(err.message)
        notify(err.message, 'error')
        return
      }
    }

    setStatus('Saving entry...')
    saveMutation.mutate(payload, {
      onSuccess: (saved) => {
        notify('Your entry has been saved.')
        navigate(`/calendar?month=${saved.date.slice(0, 7)}`, { replace: true })
      },
      onError: (error) => setStatus(error.message),
    })
  }

  return (
    <div className="min-h-screen bg-background text-on-surface pb-32">
      <header className="fixed top-0 z-40 flex w-full items-center justify-between bg-background/80 px-container-margin py-md backdrop-blur-md">
        <Link
          to="/home"
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
            {Object.values(MOODS).map((item) => {
              const selected = form.mood === item.value
              return (
                <button
                  key={item.value}
                  type="button"
                  aria-label={`Mood ${item.value} of 5 (${item.label})`}
                  aria-pressed={selected}
                  onClick={() => setForm((current) => ({ ...current, mood: item.value }))}
                  className={`flex h-12 w-12 items-center justify-center rounded-full transition-transform active:scale-95 ${item.bg} ${
                    selected ? 'ring-4 ring-primary/40 scale-105' : 'opacity-80 hover:opacity-100'
                  }`}
                >
                  <MoodIcon mood={item.value} className="text-[28px]" filled={selected} />
                </button>
              )
            })}
          </div>
          <div className="space-y-sm border-t border-surface-container pt-md">
            {TAG_CATEGORIES.map((category) => (
              <div key={category.key}>
                <span className="mb-xs block text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant/60">
                  {category.label}
                </span>
                <div className="flex flex-wrap gap-xs">
                  {category.tags.map((tag) => {
                    const selected = form.tags.includes(tag)
                    return (
                      <button
                        key={tag}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleTag(tag)}
                        className={`rounded-full px-md py-xs text-label-sm font-label-sm transition-colors ${
                          selected
                            ? 'bg-primary-container text-primary font-semibold'
                            : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                        }`}
                      >
                        {tag}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
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
          {(form.photo_url || isUploadingPhoto) && (
            <div className="mb-md">
              <ImageWithSkeleton
                src={form.photo_url}
                alt="Selected entry photo"
                className="max-h-64 w-full object-cover rounded-2xl"
                skeletonHeightClass="h-56 sm:h-64"
                isUploading={isUploadingPhoto}
                uploadingText="Uploading photo..."
              >
                {form.photo_url && !isUploadingPhoto && (
                  <button
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, photo_url: null }))}
                    aria-label="Remove photo"
                    className="absolute right-sm top-sm z-10 flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-on-surface shadow-sm hover:bg-background"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                )}
              </ImageWithSkeleton>
            </div>
          )}

          {/* Voice Note Preview or Live Recording */}
          {isRecording ? (
            <div className="mb-md flex items-center justify-between rounded-2xl bg-error-container/30 p-md border border-error/20">
              <div className="flex items-center gap-sm">
                <span className="h-3 w-3 rounded-full bg-error animate-pulse" />
                <span className="text-label-lg font-medium text-error">
                  Recording... 0:{recordingTime < 10 ? '0' : ''}{recordingTime} / 0:30
                </span>
              </div>
              <button
                type="button"
                onClick={stopRecording}
                className="flex h-9 px-md items-center gap-1 rounded-full bg-error text-on-error text-label-sm font-semibold shadow-sm hover:bg-error/90"
              >
                <span className="material-symbols-outlined text-[18px]">stop</span>
                Done
              </button>
            </div>
          ) : (audioBlob || form.audio_url) ? (
            <div className="mb-md">
              <VoiceNotePlayer
                blob={audioBlob}
                audioUrl={form.audio_url}
                duration={audioDuration || form.audio_duration}
                onDelete={clearAudio}
              />
            </div>
          ) : null}

          <div className="mt-lg flex items-center gap-md border-t border-surface-container pt-md">
            <label className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container">
              <span className="material-symbols-outlined text-[20px]">image</span>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={selectPhoto} className="sr-only" />
              <span className="sr-only">Add image</span>
            </label>

            {/* Active Mic Button */}
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              title={isRecording ? 'Stop recording' : 'Record voice note'}
              aria-label={isRecording ? 'Stop recording' : 'Record voice note'}
              className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                isRecording
                  ? 'bg-error text-on-error animate-pulse'
                  : (audioBlob || form.audio_url)
                  ? 'bg-primary-container text-primary'
                  : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">{isRecording ? 'stop' : 'mic'}</span>
            </button>

            <button
              type="button"
              disabled
              title="Attach file (coming later)"
              aria-label="Attach file (coming later)"
              className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant opacity-60"
            >
              <span className="material-symbols-outlined text-[20px]">attach_file</span>
            </button>
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

        {entryQuery.data && (
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="flex h-14 w-full items-center justify-center gap-xs rounded-full border border-error/30 bg-error-container/20 text-label-lg font-label-lg text-error hover:bg-error-container/40"
          >
            <span className="material-symbols-outlined text-[20px]">delete</span>
            <span>Delete Entry</span>
          </button>
        )}
      </form>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/40 p-container-margin backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-[24px] bg-white p-lg cloud-shadow space-y-md text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-error-container/40 text-error">
              <span className="material-symbols-outlined text-[28px]">delete</span>
            </div>
            <h2 className="text-headline-lg font-headline-lg text-on-surface">Delete this entry?</h2>
            <p className="text-body-sm text-on-surface-variant">
              This will permanently remove your mood log for {date}. This action cannot be undone.
            </p>
            <div className="flex gap-sm pt-xs">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 rounded-full bg-surface-container-high py-3 text-label-lg font-label-lg text-on-surface"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  const targetId = entryQuery.data?.id || date
                  deleteMutation.mutate(targetId, {
                    onSuccess: () => {
                      notify('Entry deleted.')
                      navigate('/calendar', { replace: true })
                    },
                    onError: (err) => {
                      notify(err.message, 'error')
                      setShowDeleteModal(false)
                    },
                  })
                }}
                className="flex-1 rounded-full bg-error py-3 text-label-lg font-label-lg text-on-error disabled:opacity-60"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}

