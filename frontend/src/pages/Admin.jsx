import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import {
  useAdminAnnouncementsQuery,
  useAdminAnnouncementStatsQuery,
  useArchiveAnnouncementMutation,
  useCreateAnnouncementMutation,
  useDeleteAnnouncementMutation,
  useProfileQuery,
  usePublishAnnouncementMutation,
  useUnpublishAnnouncementMutation,
  useUpdateAnnouncementMutation,
} from '../api/queries'
import { AdminSkeleton } from '../components/skeleton/PageSkeletons'
import { useModalKeyboard } from '../hooks/useModalKeyboard'
import { useLanguage } from '../context/LanguageContext'

function getFutureISO(hours) {
  const d = new Date()
  d.setTime(d.getTime() + hours * 60 * 60 * 1000)
  return d.toISOString()
}

export default function Admin() {
  const { t } = useLanguage()
  const { data: profileData, isLoading: isProfileLoading } = useProfileQuery()
  const user = profileData?.user

  const { data: list, isLoading, isError, error } = useAdminAnnouncementsQuery(Boolean(user?.is_admin))

  const createMutation = useCreateAnnouncementMutation()
  const updateMutation = useUpdateAnnouncementMutation()
  const publishMutation = usePublishAnnouncementMutation()
  const unpublishMutation = useUnpublishAnnouncementMutation()
  const archiveMutation = useArchiveAnnouncementMutation()
  const deleteMutation = useDeleteAnnouncementMutation()

  // Form states for creation
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [severity, setSeverity] = useState('info')
  const [kind, setKind] = useState('standard')
  const [displayType, setDisplayType] = useState('modal')
  const [expiresAt, setExpiresAt] = useState(() => getFutureISO(7 * 24))
  const [ctaLabel, setCtaLabel] = useState('')
  const [ctaUrl, setCtaUrl] = useState('')
  const [isPinned, setIsPinned] = useState(false)
  const [formError, setFormError] = useState('')
  const [showCreatePreview, setShowCreatePreview] = useState(false)

  // Edit states
  const [editingItem, setEditingItem] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editSeverity, setEditSeverity] = useState('info')
  const [editKind, setEditKind] = useState('standard')
  const [editDisplayType, setEditDisplayType] = useState('modal')
  const [editExpiresAt, setEditExpiresAt] = useState('')
  const [editCtaLabel, setEditCtaLabel] = useState('')
  const [editCtaUrl, setEditCtaUrl] = useState('')
  const [editIsPinned, setEditIsPinned] = useState(false)
  const [showEditPreview, setShowEditPreview] = useState(false)

  // Delete confirm state
  const [itemToDelete, setItemToDelete] = useState(null)

  // Stats view state
  const [statsItem, setStatsItem] = useState(null)

  // Filter tab
  const [filterTab, setFilterTab] = useState('all')

  const editModalRef = useRef(null)
  const deleteModalRef = useRef(null)
  const statsModalRef = useRef(null)

  useModalKeyboard(() => setEditingItem(null), Boolean(editingItem), editModalRef)
  useModalKeyboard(() => setItemToDelete(null), Boolean(itemToDelete), deleteModalRef)
  useModalKeyboard(() => setStatsItem(null), Boolean(statsItem), statsModalRef)

  if (isProfileLoading) {
    return (
      <AppLayout>
        <main className="mx-auto min-h-screen w-full max-w-2xl lg:max-w-6xl xl:max-w-7xl bg-background px-container-margin lg:px-6 py-lg pb-32 lg:pb-12">
          <AdminSkeleton />
        </main>
      </AppLayout>
    )
  }

  if (!user || !user.is_admin) {
    return (
      <div className="min-h-screen bg-background p-container-margin flex flex-col items-center justify-center text-center space-y-md">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-error-container/30 text-error">
          <span className="material-symbols-outlined text-[36px]">block</span>
        </div>
        <h1 className="text-headline-lg font-headline-lg text-on-surface font-bold">
          {t('admin.accessDenied', 'Access Denied')}
        </h1>
        <p className="text-body-md font-body-md text-on-surface-variant max-w-xs">
          {t('admin.accessDeniedDesc', 'You do not have administrator permissions to view this page.')}
        </p>
        <Link
          to="/home"
          className="rounded-full bg-primary px-lg py-sm text-label-lg font-label-lg text-on-primary shadow-md"
        >
          {t('common.back', 'Go back')}
        </Link>
      </div>
    )
  }

  const handleCreate = (e) => {
    e.preventDefault()
    setFormError('')
    if (!title.trim() || !body.trim()) {
      setFormError('Please fill in title and body')
      return
    }

    createMutation.mutate(
      {
        title: title.trim(),
        body: body.trim(),
        severity,
        kind,
        display_type: displayType,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        cta_label: ctaLabel.trim() || null,
        cta_url: ctaUrl.trim() || null,
        is_pinned: isPinned,
      },
      {
        onSuccess: () => {
          setTitle('')
          setBody('')
          setSeverity('info')
          setKind('standard')
          setDisplayType('modal')
          setExpiresAt(getFutureISO(7 * 24))
          setCtaLabel('')
          setCtaUrl('')
          setIsPinned(false)
          setShowCreatePreview(false)
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
    setEditKind(item.kind || 'standard')
    setEditDisplayType(item.display_type || 'modal')
    setEditExpiresAt(item.expires_at ? new Date(item.expires_at).toISOString().slice(0, 16) : '')
    setEditCtaLabel(item.cta_label || '')
    setEditCtaUrl(item.cta_url || '')
    setEditIsPinned(Boolean(item.is_pinned))
    setShowEditPreview(false)
  }

  const handleSaveEdit = (e) => {
    e.preventDefault()
    if (!editingItem) return
    updateMutation.mutate(
      {
        id: editingItem.id,
        title: editTitle.trim(),
        body: editBody.trim(),
        severity: editSeverity,
        kind: editKind,
        display_type: editDisplayType,
        expires_at: editExpiresAt ? new Date(editExpiresAt).toISOString() : null,
        cta_label: editCtaLabel.trim() || null,
        cta_url: editCtaUrl.trim() || null,
        is_pinned: editIsPinned,
      },
      {
        onSuccess: () => {
          setEditingItem(null)
        },
      },
    )
  }

  const handleConfirmDelete = () => {
    if (!itemToDelete) return
    deleteMutation.mutate(itemToDelete.id, {
      onSuccess: () => {
        setItemToDelete(null)
      },
    })
  }

  // Filter list by tab
  const filteredList = (list || []).filter((item) => {
    if (filterTab === 'all') return true
    if (filterTab === 'published') return item.status === 'published'
    if (filterTab === 'drafts') return item.status === 'draft'
    if (filterTab === 'archived') return item.status === 'archived'
    return true
  })

  return (
    <AppLayout>
      <main className="mx-auto min-h-screen w-full max-w-2xl lg:max-w-6xl xl:max-w-7xl bg-background px-container-margin lg:px-6 py-lg pb-32 lg:pb-12 text-on-background">
        <header className="flex items-center justify-between py-md mb-md">
          <div className="flex items-center gap-xs">
            <Link
              to="/home"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface shadow-card hover:bg-surface-container transition-all active:scale-95 border border-outline-variant/20"
              aria-label={t('common.back', 'Go back')}
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </Link>
            <div>
              <h1 className="text-headline-xl font-headline-xl text-on-surface font-bold">
                {t('admin.title', 'Administration')}
              </h1>
              <p className="text-label-sm text-on-surface-variant hidden sm:block">
                {t('admin.subtitle', 'Manage system announcements and platform broadcasts')}
              </p>
            </div>
          </div>
          <span className="rounded-full bg-primary-container/60 border border-primary/20 px-3 py-1 text-label-sm font-semibold text-primary">
            {t('admin.adminMode', 'Admin Mode')}
          </span>
        </header>

        {/* Create Announcement Section */}
        <section className="rounded-[24px] bg-surface-container-lowest p-6 shadow-card border border-outline-variant/20 space-y-md mb-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-headline-lg font-headline-lg font-bold text-on-surface">
              {t('admin.createAnnouncement', 'Create Announcement')}
            </h2>
            <button
              type="button"
              onClick={() => setShowCreatePreview(!showCreatePreview)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-label-sm font-semibold bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">
                {showCreatePreview ? 'visibility_off' : 'visibility'}
              </span>
              <span>{showCreatePreview ? t('admin.hidePreview', 'Hide Preview') : t('admin.livePreview', 'Live Preview')}</span>
            </button>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            {formError && (
              <p className="text-body-sm font-medium text-error bg-error-container/30 p-3 rounded-xl border border-error/10">
                {formError}
              </p>
            )}

            {/* Title */}
            <div>
              <label htmlFor="title-input" className="block text-label-sm font-semibold text-on-surface-variant mb-1.5">
                {t('admin.fieldTitle', 'Title')}
              </label>
              <input
                id="title-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('admin.fieldTitlePlaceholder', 'e.g. Scheduled Maintenance or New Feature')}
                className="h-[50px] w-full rounded-2xl border-0 bg-surface-container px-4 text-body-md text-on-surface outline-none transition-all focus:bg-surface-container-low focus:ring-2 focus:ring-primary shadow-subtle"
              />
            </div>

            {/* Body */}
            <div>
              <label htmlFor="body-input" className="block text-label-sm font-semibold text-on-surface-variant mb-1.5">
                {t('admin.fieldBody', 'Body Text')}
              </label>
              <textarea
                id="body-input"
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={t('admin.fieldBodyPlaceholder', 'Enter detailed announcement message...')}
                className="w-full rounded-2xl border-0 bg-surface-container p-4 text-body-md text-on-surface outline-none transition-all focus:bg-surface-container-low focus:ring-2 focus:ring-primary shadow-subtle resize-none"
              />
            </div>

            {/* Grid 3 Columns: Severity, Kind, DisplayType */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-label-sm font-semibold text-on-surface-variant mb-1.5">
                  {t('admin.fieldSeverity', 'Severity')}
                </label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="h-[48px] w-full rounded-2xl border-0 bg-surface-container px-3.5 text-body-md text-on-surface outline-none transition-all focus:ring-2 focus:ring-primary shadow-subtle"
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-label-sm font-semibold text-on-surface-variant mb-1.5">
                  {t('admin.fieldKind', 'Audience Type')}
                </label>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                  className="h-[48px] w-full rounded-2xl border-0 bg-surface-container px-3.5 text-body-md text-on-surface outline-none transition-all focus:ring-2 focus:ring-primary shadow-subtle"
                >
                  <option value="standard">{t('admin.kindStandard', 'Standard (existing users)')}</option>
                  <option value="onboarding">{t('admin.kindOnboarding', 'Onboarding (new users)')}</option>
                </select>
              </div>

              <div>
                <label className="block text-label-sm font-semibold text-on-surface-variant mb-1.5">
                  {t('admin.fieldDisplayType', 'Display Format')}
                </label>
                <select
                  value={displayType}
                  onChange={(e) => setDisplayType(e.target.value)}
                  className="h-[48px] w-full rounded-2xl border-0 bg-surface-container px-3.5 text-body-md text-on-surface outline-none transition-all focus:ring-2 focus:ring-primary shadow-subtle"
                >
                  <option value="modal">{t('admin.displayModal', 'Modal Window')}</option>
                  <option value="banner">{t('admin.displayBanner', 'Top Floating Banner')}</option>
                  <option value="feed_only">{t('admin.displayFeedOnly', 'Archive / Inbox only')}</option>
                </select>
              </div>
            </div>

            {/* Expiration Presets */}
            <div className="space-y-1.5">
              <label className="block text-label-sm font-semibold text-on-surface-variant">
                {t('admin.fieldExpiresAt', 'Delivery Expiration')}
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { label: t('admin.preset24h', '24 hours'), hours: 24 },
                  { label: t('admin.preset3d', '3 days'), hours: 3 * 24 },
                  { label: t('admin.preset7d', '7 days'), hours: 7 * 24 },
                  { label: t('admin.preset30d', '30 days'), hours: 30 * 24 },
                ].map((preset) => (
                  <button
                    key={preset.hours}
                    type="button"
                    onClick={() => setExpiresAt(getFutureISO(preset.hours))}
                    className="px-3 py-1.5 rounded-xl text-label-sm bg-surface-container hover:bg-surface-container-high transition-colors active:scale-95"
                  >
                    {preset.label}
                  </button>
                ))}
                <input
                  type="datetime-local"
                  value={expiresAt ? new Date(expiresAt).toISOString().slice(0, 16) : ''}
                  onChange={(e) => setExpiresAt(e.target.value ? new Date(e.target.value).toISOString() : '')}
                  className="h-[38px] rounded-xl bg-surface-container px-3 text-label-sm text-on-surface outline-none border-0"
                />
              </div>
            </div>

            {/* CTA Fields & Pin */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-label-sm font-semibold text-on-surface-variant mb-1">
                  {t('admin.fieldCtaLabel', 'Action Button Label')}
                </label>
                <input
                  type="text"
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  placeholder={t('admin.fieldCtaLabelPlaceholder', 'e.g. Try it now')}
                  className="h-[46px] w-full rounded-2xl border-0 bg-surface-container px-4 text-body-md text-on-surface outline-none"
                />
              </div>
              <div>
                <label className="block text-label-sm font-semibold text-on-surface-variant mb-1">
                  {t('admin.fieldCtaUrl', 'Action Button Link')}
                </label>
                <input
                  type="text"
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                  placeholder={t('admin.fieldCtaUrlPlaceholder', 'e.g. /profile or https://...')}
                  className="h-[46px] w-full rounded-2xl border-0 bg-surface-container px-4 text-body-md text-on-surface outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="pinned-checkbox"
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="h-4 w-4 rounded text-primary focus:ring-primary"
              />
              <label htmlFor="pinned-checkbox" className="text-label-sm text-on-surface cursor-pointer select-none">
                {t('admin.fieldIsPinned', 'Pin to archive top')}
              </label>
            </div>

            {/* Live Preview Box */}
            {showCreatePreview && (
              <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 space-y-3">
                <div className="flex items-center justify-between text-label-small text-outline">
                  <span>PREVIEW: {displayType.toUpperCase()} ({severity.toUpperCase()})</span>
                </div>
                {displayType === 'banner' ? (
                  <div className="p-3.5 rounded-2xl bg-surface-container-lowest shadow-card max-w-md mx-auto border border-outline-variant/20 text-left space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container/30 text-primary">
                          <span className="material-symbols-outlined text-[18px]">campaign</span>
                        </div>
                        <h4 className="text-title-small font-bold text-on-surface truncate">
                          {title || 'Preview Title'}
                        </h4>
                      </div>
                      <span className="text-outline material-symbols-outlined text-[18px]">close</span>
                    </div>
                    <div className="pl-10 text-body-sm text-on-surface-variant">
                      <p className="line-clamp-2 leading-relaxed">
                        {body || 'Detailed preview announcement message goes here with full readability...'}
                      </p>
                    </div>
                    {ctaLabel && (
                      <div className="pl-10 pt-1">
                        <span className="inline-block rounded-xl bg-primary px-3 py-1.5 text-label-sm font-semibold text-on-primary">
                          {ctaLabel}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-5 rounded-[24px] bg-surface-container-lowest shadow-card max-w-sm mx-auto border border-outline-variant/20 space-y-3 text-left">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-container/30 text-primary">
                        <span className="material-symbols-outlined text-[22px]">campaign</span>
                      </div>
                      <h3 className="text-title-medium font-bold text-on-surface pt-1">{title || 'Preview Title'}</h3>
                    </div>
                    <div className="max-h-36 overflow-y-auto pr-1 text-body-sm text-on-surface-variant whitespace-pre-wrap leading-relaxed border-y border-outline-variant/15 py-2">
                      {body || 'Detailed preview body text with long message and full scrollability...'}
                    </div>
                    <div className="flex flex-col gap-2 pt-1">
                      {ctaLabel && (
                        <button type="button" className="h-10 w-full rounded-xl bg-primary text-on-primary text-label-sm font-semibold">
                          {ctaLabel}
                        </button>
                      )}
                      <button type="button" className="h-10 w-full rounded-xl bg-surface-container text-on-surface-variant text-label-sm font-semibold">
                        {t('common.gotIt', 'Got it')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="h-12 w-full rounded-2xl bg-primary text-label-lg font-semibold text-on-primary shadow-card hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-50"
            >
              {createMutation.isPending ? t('common.saving', 'Saving...') : t('admin.createDraft', 'Create Draft')}
            </button>
          </form>
        </section>

        {/* Filter Tabs & Announcements List */}
        <section className="space-y-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-headline-lg font-headline-lg font-bold text-on-surface">
              {t('admin.allAnnouncements', 'All Announcements')}
            </h2>
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 text-label-sm font-semibold">
              {[
                { id: 'all', label: t('admin.tabAll', 'All') },
                { id: 'published', label: t('admin.tabPublished', 'Active') },
                { id: 'drafts', label: t('admin.tabDrafts', 'Drafts') },
                { id: 'archived', label: t('admin.tabArchived', 'Archived') },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id)}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    filterTab === tab.id
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {isLoading && <AdminSkeleton />}
          {isError && (
            <p className="text-body-sm font-body-sm text-error">{error?.message || 'Failed to load'}</p>
          )}

          {!isLoading && filteredList.length === 0 && (
            <div className="rounded-[24px] bg-surface-container-lowest p-8 text-center text-body-medium text-on-surface-variant shadow-card border border-outline-variant/20">
              {t('admin.noAnnouncements', 'No announcements yet.')}
            </div>
          )}

          <div className="space-y-md">
            {filteredList.map((item) => {
              const isExpired = item.status === 'published' && item.expires_at && new Date(item.expires_at) < new Date()
              return (
                <div
                  key={item.id}
                  className="rounded-[24px] bg-surface-container-lowest p-6 shadow-card border border-outline-variant/20 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-label-small font-semibold ${severityBadgeClass(item.severity)}`}>
                        {item.severity}
                      </span>
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-label-small font-semibold ${statusBadgeClass(item.status, isExpired)}`}>
                        {isExpired ? t('admin.statusExpired', 'Expired') : item.status}
                      </span>
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-label-small bg-surface-container text-on-surface-variant font-medium">
                        {item.display_type}
                      </span>
                      {item.kind === 'onboarding' && (
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-label-small bg-secondary-container text-on-secondary-container font-semibold">
                          Onboarding
                        </span>
                      )}
                      {item.is_pinned && (
                        <span className="inline-flex items-center gap-0.5 text-label-small text-primary font-semibold">
                          <span className="material-symbols-outlined text-[14px]">push_pin</span>
                          Pinned
                        </span>
                      )}
                    </div>
                    <span className="text-label-small text-outline">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="text-headline-sm font-bold text-on-surface">
                    {item.title}
                  </h3>
                  <p className="text-body-md text-on-surface-variant whitespace-pre-wrap">
                    {item.body}
                  </p>

                  {/* Metrics and Dates info */}
                  <div className="flex flex-wrap items-center justify-between gap-4 text-label-small text-on-surface-variant/80 pt-2 border-t border-surface-container">
                    <button
                      type="button"
                      onClick={() => setStatsItem(item)}
                      className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-surface-container/70 hover:bg-surface-container transition-colors cursor-pointer text-left group"
                      title={t('admin.statsModalTitle', 'Interaction Statistics')}
                    >
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px] text-primary group-hover:scale-110 transition-transform">visibility</span>
                        <span>{t('admin.readsCount', 'Reads')}: <strong className="text-on-surface">{item.reads_count || 0}</strong></span>
                      </div>
                      <span className="text-outline">·</span>
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px] text-outline group-hover:scale-110 transition-transform">close</span>
                        <span>{t('admin.dismissesCount', 'Dismisses')}: <strong className="text-on-surface">{item.dismisses_count || 0}</strong></span>
                      </div>
                      <span className="material-symbols-outlined text-[14px] text-outline ml-0.5">chevron_right</span>
                    </button>
                    {item.expires_at && (
                      <div className="flex items-center gap-1 text-outline">
                        <span className="material-symbols-outlined text-[16px]">schedule</span>
                        <span>Expires: {new Date(item.expires_at).toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-surface-container">
                    <button
                      type="button"
                      onClick={() => setStatsItem(item)}
                      className="rounded-xl bg-surface-container px-3.5 py-1.5 text-label-sm font-semibold text-on-surface-variant hover:bg-surface-container-high transition-all active:scale-95 flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px] text-primary">bar_chart</span>
                      {t('admin.stats', 'Stats')}
                    </button>
                    {item.status !== 'published' && (
                      <button
                        type="button"
                        onClick={() => publishMutation.mutate(item.id)}
                        disabled={publishMutation.isPending}
                        className="rounded-xl bg-secondary-container px-3.5 py-1.5 text-label-sm font-semibold text-on-secondary-container hover:bg-secondary-container/80 transition-all active:scale-95"
                      >
                        {t('admin.publish', 'Publish')}
                      </button>
                    )}
                    {item.status === 'published' && (
                      <button
                        type="button"
                        onClick={() => unpublishMutation.mutate(item.id)}
                        disabled={unpublishMutation.isPending}
                        className="rounded-xl bg-tertiary-container px-3.5 py-1.5 text-label-sm font-semibold text-on-tertiary-container hover:bg-tertiary-container/80 transition-all active:scale-95"
                      >
                        {t('admin.unpublish', 'Unpublish')}
                      </button>
                    )}
                    {item.status !== 'archived' && (
                      <button
                        type="button"
                        onClick={() => archiveMutation.mutate(item.id)}
                        disabled={archiveMutation.isPending}
                        className="rounded-xl bg-surface-container px-3.5 py-1.5 text-label-sm font-semibold text-on-surface-variant hover:bg-surface-container-high transition-all active:scale-95"
                      >
                        {t('admin.archive', 'Archive')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleStartEdit(item)}
                      className="rounded-xl bg-primary-container px-3.5 py-1.5 text-label-sm font-semibold text-on-primary-container hover:bg-primary-container/80 transition-all active:scale-95"
                    >
                      {t('common.edit', 'Edit')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemToDelete(item)}
                      className="rounded-xl bg-error-container/30 px-3.5 py-1.5 text-label-sm font-semibold text-error hover:bg-error-container/50 transition-all active:scale-95"
                    >
                      {t('admin.delete', 'Delete')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Edit Modal */}
        {editingItem && (
          <div
            role="dialog"
            aria-modal="true"
            onClick={() => setEditingItem(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-container-margin backdrop-blur-sm animate-in fade-in duration-200"
          >
            <div
              ref={editModalRef}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-[28px] bg-surface-container-lowest p-6 shadow-modal border border-outline-variant/20 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-headline-sm font-bold text-on-surface">
                  {t('admin.editAnnouncement', 'Edit Announcement')}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <label className="block text-label-sm font-semibold text-on-surface-variant mb-1.5">
                    {t('admin.fieldTitle', 'Title')}
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="h-[48px] w-full rounded-2xl border-0 bg-surface-container px-4 text-body-md text-on-surface outline-none"
                  />
                </div>

                <div>
                  <label className="block text-label-sm font-semibold text-on-surface-variant mb-1.5">
                    {t('admin.fieldBody', 'Body Text')}
                  </label>
                  <textarea
                    rows={3}
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    className="w-full rounded-2xl border-0 bg-surface-container p-4 text-body-md text-on-surface outline-none resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-label-sm font-semibold text-on-surface-variant mb-1">
                      {t('admin.fieldSeverity', 'Severity')}
                    </label>
                    <select
                      value={editSeverity}
                      onChange={(e) => setEditSeverity(e.target.value)}
                      className="h-[46px] w-full rounded-2xl border-0 bg-surface-container px-3 text-body-md text-on-surface outline-none"
                    >
                      <option value="info">Info</option>
                      <option value="warning">Warning</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-label-sm font-semibold text-on-surface-variant mb-1">
                      {t('admin.fieldKind', 'Audience')}
                    </label>
                    <select
                      value={editKind}
                      onChange={(e) => setEditKind(e.target.value)}
                      className="h-[46px] w-full rounded-2xl border-0 bg-surface-container px-3 text-body-md text-on-surface outline-none"
                    >
                      <option value="standard">{t('admin.kindStandard', 'Standard')}</option>
                      <option value="onboarding">{t('admin.kindOnboarding', 'Onboarding')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-label-sm font-semibold text-on-surface-variant mb-1">
                      {t('admin.fieldDisplayType', 'Format')}
                    </label>
                    <select
                      value={editDisplayType}
                      onChange={(e) => setEditDisplayType(e.target.value)}
                      className="h-[46px] w-full rounded-2xl border-0 bg-surface-container px-3 text-body-md text-on-surface outline-none"
                    >
                      <option value="modal">{t('admin.displayModal', 'Modal')}</option>
                      <option value="banner">{t('admin.displayBanner', 'Banner')}</option>
                      <option value="feed_only">{t('admin.displayFeedOnly', 'Archive only')}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-label-sm font-semibold text-on-surface-variant mb-1">
                    {t('admin.fieldExpiresAt', 'Expires At')}
                  </label>
                  <input
                    type="datetime-local"
                    value={editExpiresAt}
                    onChange={(e) => setEditExpiresAt(e.target.value)}
                    className="h-[46px] w-full rounded-2xl border-0 bg-surface-container px-4 text-body-md text-on-surface outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-label-sm font-semibold text-on-surface-variant mb-1">
                      {t('admin.fieldCtaLabel', 'CTA Label')}
                    </label>
                    <input
                      type="text"
                      value={editCtaLabel}
                      onChange={(e) => setEditCtaLabel(e.target.value)}
                      className="h-[46px] w-full rounded-2xl border-0 bg-surface-container px-4 text-body-md text-on-surface outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-label-sm font-semibold text-on-surface-variant mb-1">
                      {t('admin.fieldCtaUrl', 'CTA URL')}
                    </label>
                    <input
                      type="text"
                      value={editCtaUrl}
                      onChange={(e) => setEditCtaUrl(e.target.value)}
                      className="h-[46px] w-full rounded-2xl border-0 bg-surface-container px-4 text-body-md text-on-surface outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="edit-pinned-checkbox"
                    type="checkbox"
                    checked={editIsPinned}
                    onChange={(e) => setEditIsPinned(e.target.checked)}
                    className="h-4 w-4 rounded text-primary focus:ring-primary"
                  />
                  <label htmlFor="edit-pinned-checkbox" className="text-label-sm text-on-surface cursor-pointer select-none">
                    {t('admin.fieldIsPinned', 'Pin to archive top')}
                  </label>
                </div>

                <div className="flex items-center gap-3 pt-xs">
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="h-12 flex-1 rounded-2xl bg-surface-container text-label-lg font-semibold text-on-surface-variant transition-all hover:bg-surface-container-high active:scale-[0.99]"
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="h-12 flex-1 rounded-2xl bg-primary text-label-lg font-semibold text-on-primary shadow-card hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-50"
                  >
                    {updateMutation.isPending ? t('common.saving', 'Saving...') : t('admin.saveChanges', 'Save Changes')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {itemToDelete && (
          <div
            role="dialog"
            aria-modal="true"
            onClick={() => setItemToDelete(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-container-margin backdrop-blur-sm animate-in fade-in duration-200"
          >
            <div
              ref={deleteModalRef}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-[28px] bg-surface-container-lowest p-6 shadow-modal border border-outline-variant/20 text-center space-y-4"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-error-container/30 text-error mx-auto">
                <span className="material-symbols-outlined text-[32px]">delete</span>
              </div>
              <h3 className="text-headline-sm font-bold text-on-surface">
                {t('admin.deleteConfirmTitle', 'Delete Announcement')}
              </h3>
              <p className="text-body-md text-on-surface-variant">
                {t('admin.deleteConfirmDesc', 'Are you sure you want to permanently delete this announcement?')}
              </p>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setItemToDelete(null)}
                  className="h-11 flex-1 rounded-xl bg-surface-container text-label-md font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleteMutation.isPending}
                  className="h-11 flex-1 rounded-xl bg-error text-label-md font-semibold text-on-error hover:bg-error/90 transition-colors disabled:opacity-50"
                >
                  {deleteMutation.isPending ? t('common.saving', 'Deleting...') : t('admin.delete', 'Delete')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Modal */}
        {statsItem && (
          <AnnouncementStatsModal
            item={statsItem}
            onClose={() => setStatsItem(null)}
            modalRef={statsModalRef}
            t={t}
          />
        )}
      </main>
    </AppLayout>
  )
}

function AnnouncementStatsModal({ item, onClose, modalRef, t }) {
  const [activeTab, setActiveTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const { data: statsData, isLoading, isError, error } = useAdminAnnouncementStatsQuery(item?.id, Boolean(item?.id))

  const totalReads = statsData?.reads_count ?? item?.reads_count ?? 0
  const totalDismisses = statsData?.dismisses_count ?? item?.dismisses_count ?? 0
  const interactions = statsData?.interactions || []

  const filteredInteractions = interactions.filter((u) => {
    if (activeTab === 'read' && !u.read_at) return false
    if (activeTab === 'dismissed' && !u.dismissed_at) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const nameMatch = u.display_name?.toLowerCase().includes(q)
      const usernameMatch = u.username?.toLowerCase().includes(q)
      if (!nameMatch && !usernameMatch) return false
    }
    return true
  })

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-container-margin backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-[28px] bg-surface-container-lowest p-6 shadow-modal border border-outline-variant/20 flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-surface-container">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-primary">bar_chart</span>
              <h3 className="text-headline-sm font-bold text-on-surface truncate">
                {t('admin.statsModalTitle', 'Interaction Statistics')}
              </h3>
            </div>
            <p className="text-body-sm font-medium text-on-surface-variant truncate">
              {item.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-all active:scale-95"
            aria-label={t('common.close', 'Close')}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Overview Stats Cards */}
        <div className="grid grid-cols-2 gap-3 py-4 border-b border-surface-container">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface-container-low border border-outline-variant/20">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-[20px]">visibility</span>
            </div>
            <div>
              <div className="text-headline-sm font-bold text-on-surface">{totalReads}</div>
              <div className="text-label-sm text-on-surface-variant">{t('admin.readsCount', 'Reads')}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface-container-low border border-outline-variant/20">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </div>
            <div>
              <div className="text-headline-sm font-bold text-on-surface">{totalDismisses}</div>
              <div className="text-label-sm text-on-surface-variant">{t('admin.dismissesCount', 'Dismisses')}</div>
            </div>
          </div>
        </div>

        {/* Filter Tabs & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-4 pb-3">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-container border border-outline-variant/15 text-label-sm font-semibold">
            {[
              { id: 'all', label: `${t('admin.statsTabAll', 'All')} (${interactions.length})` },
              { id: 'read', label: `${t('admin.statsTabRead', 'Read')} (${totalReads})` },
              { id: 'dismissed', label: `${t('admin.statsTabDismissed', 'Dismissed')} (${totalDismisses})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg transition-all text-xs font-semibold ${
                  activeTab === tab.id
                    ? 'bg-surface-container-lowest text-on-surface shadow-xs font-bold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {interactions.length > 4 && (
            <div className="relative">
              <span className="material-symbols-outlined text-[16px] text-outline absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="h-8 pl-7 pr-3 w-full sm:w-32 text-body-sm rounded-xl bg-surface-container text-on-surface outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}
        </div>

        {/* User Interaction List (Scrollable) */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2 py-1 min-h-[160px]">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-on-surface-variant space-y-2">
              <span className="material-symbols-outlined text-[28px] animate-spin text-primary">progress_activity</span>
              <p className="text-body-sm">{t('admin.statsLoading', 'Loading statistics...')}</p>
            </div>
          )}

          {isError && (
            <div className="p-4 rounded-2xl bg-error-container/20 text-error text-body-sm text-center">
              {error?.message || 'Failed to load statistics'}
            </div>
          )}

          {!isLoading && !isError && interactions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-on-surface-variant space-y-2">
              <span className="material-symbols-outlined text-[36px] text-outline">group_off</span>
              <p className="text-body-sm max-w-xs">
                {t('admin.statsNoInteractions', 'No user interactions recorded for this announcement yet.')}
              </p>
            </div>
          )}

          {!isLoading && !isError && interactions.length > 0 && filteredInteractions.length === 0 && (
            <div className="text-center py-8 text-on-surface-variant text-body-sm">
              No matching users found.
            </div>
          )}

          {!isLoading && !isError && filteredInteractions.map((u) => (
            <div
              key={u.user_id}
              className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-surface-container-low hover:bg-surface-container transition-colors border border-outline-variant/15"
            >
              <div className="flex items-center gap-3 min-w-0">
                {u.avatar_url ? (
                  <img
                    src={u.avatar_url}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover border border-outline-variant/30 shrink-0"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-label-md font-bold text-on-primary-container">
                    {(u.display_name || u.username || '?')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-semibold text-on-surface text-body-md truncate">
                    {u.display_name || u.username}
                  </div>
                  <div className="text-label-sm text-outline truncate">
                    @{u.username}
                  </div>
                </div>
              </div>

              {/* Status Badges */}
              <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                {u.read_at && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label-small font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                    <span className="material-symbols-outlined text-[13px]">visibility</span>
                    <span>{t('admin.statsReadAt', 'Read')}: {new Date(u.read_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                )}
                {u.dismissed_at && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label-small font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400">
                    <span className="material-symbols-outlined text-[13px]">close</span>
                    <span>{t('admin.statsDismissedAt', 'Dismissed')}: {new Date(u.dismissed_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-surface-container flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-5 rounded-xl bg-surface-container text-label-md font-semibold text-on-surface hover:bg-surface-container-high transition-colors"
          >
            {t('common.close', 'Close')}
          </button>
        </div>
      </div>
    </div>
  )
}

function severityBadgeClass(severity) {
  switch (severity) {
    case 'critical':
      return 'bg-error-container/40 text-error'
    case 'warning':
      return 'bg-tertiary-container/40 text-amber-600 dark:text-amber-400'
    case 'info':
    default:
      return 'bg-primary-container/40 text-primary'
  }
}

function statusBadgeClass(status, isExpired) {
  if (isExpired) {
    return 'bg-error-container/30 text-error'
  }
  switch (status) {
    case 'published':
      return 'bg-secondary-container text-on-secondary-container'
    case 'archived':
      return 'bg-surface-container-high text-on-surface-variant'
    case 'draft':
    default:
      return 'bg-surface-container text-on-surface-variant'
  }
}
