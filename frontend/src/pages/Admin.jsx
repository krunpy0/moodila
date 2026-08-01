import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useAdminAnnouncementsQuery,
  useArchiveAnnouncementMutation,
  useCreateAnnouncementMutation,
  useProfileQuery,
  usePublishAnnouncementMutation,
  useUpdateAnnouncementMutation,
} from '../api/queries'

const severityOptions = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
]

export default function Admin() {
  const { data: profileData, isLoading: isProfileLoading } = useProfileQuery()
  const user = profileData?.user

  const { data: list, isLoading, isError, error } = useAdminAnnouncementsQuery(Boolean(user?.is_admin))

  const createMutation = useCreateAnnouncementMutation()
  const updateMutation = useUpdateAnnouncementMutation()
  const publishMutation = usePublishAnnouncementMutation()
  const archiveMutation = useArchiveAnnouncementMutation()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [severity, setSeverity] = useState('info')
  const [editingItem, setEditingItem] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editSeverity, setEditSeverity] = useState('info')
  const [formError, setFormError] = useState('')

  if (isProfileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-on-surface-variant">
        Loading...
      </div>
    )
  }

  if (!user || !user.is_admin) {
    return (
      <div className="min-h-screen bg-background p-container-margin flex flex-col items-center justify-center text-center space-y-md">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-error-container/30 text-error">
          <span className="material-symbols-outlined text-[36px]">block</span>
        </div>
        <h1 className="text-headline-lg font-headline-lg text-on-surface">Access Denied</h1>
        <p className="text-body-md font-body-md text-on-surface-variant max-w-xs">
          You do not have administrator permissions to view this page.
        </p>
        <Link
          to="/home"
          className="rounded-full bg-primary px-lg py-sm text-label-lg font-label-lg text-on-primary shadow-md"
        >
          Back to Home
        </Link>
      </div>
    )
  }

  const handleCreate = (e) => {
    e.preventDefault()
    setFormError('')
    if (!title.trim() || !body.trim()) {
      setFormError('Please fill in the title and body of the announcement')
      return
    }
    createMutation.mutate(
      { title: title.trim(), body: body.trim(), severity },
      {
        onSuccess: () => {
          setTitle('')
          setBody('')
          setSeverity('info')
        },
        onError: (err) => {
          setFormError(err.message || 'Error creating announcement')
        },
      },
    )
  }

  const handleStartEdit = (item) => {
    setEditingItem(item)
    setEditTitle(item.title)
    setEditBody(item.body)
    setEditSeverity(item.severity)
  }

  const handleSaveEdit = (e) => {
    e.preventDefault()
    if (!editingItem) return
    updateMutation.mutate(
      { id: editingItem.id, title: editTitle.trim(), body: editBody.trim(), severity: editSeverity },
      {
        onSuccess: () => {
          setEditingItem(null)
        },
      },
    )
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl bg-background px-container-margin py-lg pb-32 text-on-background">
      <header className="flex items-center justify-between py-md mb-md">
        <div className="flex items-center gap-xs">
          <Link
            to="/home"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface-variant cloud-shadow"
            aria-label="Back"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </Link>
          <h1 className="text-headline-lg font-headline-lg text-on-surface font-bold">
            Administration
          </h1>
        </div>
        <span className="rounded-full bg-primary-container px-sm py-xs text-label-sm font-label-sm text-on-primary-container font-semibold">
          Admin Mode
        </span>
      </header>

      <section className="rounded-[24px] bg-surface-container-lowest p-lg cloud-shadow space-y-md mb-lg">
        <h2 className="text-headline-lg font-headline-lg text-on-surface">Create Announcement</h2>
        <form onSubmit={handleCreate} className="space-y-md">
          {formError && (
            <p className="text-body-sm font-body-sm text-error bg-error-container/20 p-sm rounded-lg">
              {formError}
            </p>
          )}
          <div>
            <label htmlFor="title-input" className="block text-label-sm font-label-sm text-on-surface-variant mb-xs">
              Title
            </label>
            <input
              id="title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Scheduled Maintenance"
              className="w-full rounded-xl bg-surface-container-low px-md py-sm text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="body-input" className="block text-label-sm font-label-sm text-on-surface-variant mb-xs">
              Body Text
            </label>
            <textarea
              id="body-input"
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Enter detailed message..."
              className="w-full rounded-xl bg-surface-container-low px-md py-sm text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="severity-select" className="block text-label-sm font-label-sm text-on-surface-variant mb-xs">
              Severity
            </label>
            <select
              id="severity-select"
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="w-full rounded-xl bg-surface-container-low px-md py-sm text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {severityOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full rounded-full bg-primary px-lg py-sm text-label-lg font-label-lg text-on-primary shadow-md hover:bg-primary/90 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Saving...' : 'Create Draft'}
          </button>
        </form>
      </section>

      <section className="space-y-md">
        <h2 className="text-headline-lg font-headline-lg text-on-surface">All Announcements</h2>

        {isLoading && (
          <p className="text-body-sm font-body-sm text-on-surface-variant">Loading announcements...</p>
        )}
        {isError && (
          <p className="text-body-sm font-body-sm text-error">{error?.message || 'Failed to load'}</p>
        )}

        {!isLoading && list && list.length === 0 && (
          <div className="rounded-[24px] bg-surface-container-lowest p-lg text-center text-body-sm text-on-surface-variant cloud-shadow">
            No announcements yet. Create your first announcement above.
          </div>
        )}

        <div className="space-y-md">
          {list?.map((item) => (
            <div
              key={item.id}
              className="rounded-[24px] bg-surface-container-lowest p-lg cloud-shadow space-y-sm"
            >
              <div className="flex items-start justify-between gap-sm">
                <div>
                  <span className={`inline-block px-sm py-0.5 rounded-full text-label-sm font-label-sm font-semibold mr-xs ${severityBadgeClass(item.severity)}`}>
                    {item.severity}
                  </span>
                  <span className={`inline-block px-sm py-0.5 rounded-full text-label-sm font-label-sm font-semibold ${statusBadgeClass(item.status)}`}>
                    {item.status}
                  </span>
                </div>
                <span className="text-label-sm text-on-surface-variant/70">
                  {new Date(item.created_at).toLocaleDateString()}
                </span>
              </div>

              <h3 className="text-headline-lg font-headline-lg text-on-surface font-bold">
                {item.title}
              </h3>
              <p className="text-body-md font-body-md text-on-surface-variant whitespace-pre-wrap">
                {item.body}
              </p>

              {item.published_at && (
                <p className="text-label-sm text-on-surface-variant/60">
                  Published: {new Date(item.published_at).toLocaleString()}
                </p>
              )}

              <div className="flex flex-wrap gap-xs pt-xs border-t border-outline-variant/30">
                {item.status !== 'published' && (
                  <button
                    type="button"
                    onClick={() => publishMutation.mutate(item.id)}
                    disabled={publishMutation.isPending}
                    className="rounded-full bg-secondary-container px-md py-xs text-label-sm font-label-sm text-on-secondary-container hover:bg-secondary-container/80"
                  >
                    Publish
                  </button>
                )}
                {item.status !== 'archived' && (
                  <button
                    type="button"
                    onClick={() => archiveMutation.mutate(item.id)}
                    disabled={archiveMutation.isPending}
                    className="rounded-full bg-surface-container-high px-md py-xs text-label-sm font-label-sm text-on-surface-variant hover:bg-surface-container-highest"
                  >
                    Archive
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleStartEdit(item)}
                  className="rounded-full bg-primary-container px-md py-xs text-label-sm font-label-sm text-on-primary-container hover:bg-primary-container/80"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-container-margin backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[24px] bg-surface-container-lowest p-lg cloud-shadow space-y-md">
            <div className="flex items-center justify-between">
              <h3 className="text-headline-lg font-headline-lg text-on-surface font-bold">
                Edit Announcement
              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-md">
              <div>
                <label className="block text-label-sm font-label-sm text-on-surface-variant mb-xs">
                  Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-xl bg-surface-container-low px-md py-sm text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-label-sm font-label-sm text-on-surface-variant mb-xs">
                  Body Text
                </label>
                <textarea
                  rows={3}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className="w-full rounded-xl bg-surface-container-low px-md py-sm text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-label-sm font-label-sm text-on-surface-variant mb-xs">
                  Severity
                </label>
                <select
                  value={editSeverity}
                  onChange={(e) => setEditSeverity(e.target.value)}
                  className="w-full rounded-xl bg-surface-container-low px-md py-sm text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {severityOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-xs pt-xs">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="rounded-full bg-surface-container px-lg py-sm text-label-lg font-label-lg text-on-surface-variant"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="rounded-full bg-primary px-lg py-sm text-label-lg font-label-lg text-on-primary shadow-md"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}

function severityBadgeClass(severity) {
  switch (severity) {
    case 'critical':
      return 'bg-error-container text-on-error-container'
    case 'warning':
      return 'bg-tertiary-container text-on-tertiary-container'
    case 'info':
    default:
      return 'bg-primary-container text-on-primary-container'
  }
}

function statusBadgeClass(status) {
  switch (status) {
    case 'published':
      return 'bg-secondary-container text-on-secondary-container'
    case 'archived':
      return 'bg-surface-container-high text-on-surface-variant'
    case 'draft':
    default:
      return 'bg-surface-variant text-on-surface-variant'
  }
}
