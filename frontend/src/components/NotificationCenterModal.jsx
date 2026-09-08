import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useNotificationsQuery,
  useMarkNotificationsAsReadMutation,
  useAnnouncementsInboxQuery,
  useMarkAnnouncementReadMutation,
} from '../api/queries'
import { useLanguage } from '../context/LanguageContext'
import { getPushSubscriptionState, subscribeToPushNotifications, unsubscribeFromPushNotifications } from '../api/push'
import { NotificationSkeleton } from './skeleton/PageSkeletons'
import { useModalKeyboard } from '../hooks/useModalKeyboard'
import NotificationSettingsModal from './NotificationSettingsModal'

function formatRelativeTime(dateString, t) {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now - date) / 1000)

  if (seconds < 60) return t('notifications.justNow', 'just now')
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return t('notifications.minutesAgo', { m: minutes }) || `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('notifications.hoursAgo', { h: hours }) || `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return t('notifications.daysAgo', { d: days }) || `${days}d ago`
  return date.toLocaleDateString()
}

const severityBadgeStyles = {
  critical: 'bg-error-container/40 text-error border-error/20',
  warning: 'bg-tertiary-container/40 text-amber-600 dark:text-amber-400 border-amber-500/20',
  info: 'bg-primary-container/40 text-primary border-primary/20',
}

export default function NotificationCenterModal({ isOpen, onClose }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('notifications')
  const { data: notifications = [], isLoading } = useNotificationsQuery(isOpen)
  const { data: inboxAnnouncements = [], isLoading: isInboxLoading } = useAnnouncementsInboxQuery(isOpen)
  const markReadMutation = useMarkNotificationsAsReadMutation()
  const markAnnouncementReadMutation = useMarkAnnouncementReadMutation()
  const { t } = useLanguage()
  const [pushState, setPushState] = useState({ supported: true, subscribed: false, permission: 'default', loading: false, error: '' })
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const modalRef = useRef(null)

  useModalKeyboard(onClose, isOpen, modalRef)

  useEffect(() => {
    if (!isOpen) return
    getPushSubscriptionState().then((state) => {
      setPushState((prev) => ({ ...prev, ...state }))
    })
  }, [isOpen])

  const handleTogglePush = async () => {
    setPushState((prev) => ({ ...prev, loading: true, error: '' }))
    try {
      if (pushState.subscribed) {
        await unsubscribeFromPushNotifications()
        setPushState((prev) => ({ ...prev, subscribed: false, loading: false }))
      } else {
        await subscribeToPushNotifications()
        setPushState((prev) => ({ ...prev, subscribed: true, permission: 'granted', loading: false }))
      }
    } catch (err) {
      setPushState((prev) => ({ ...prev, loading: false, error: err.message || 'Error' }))
    }
  }

  if (!isOpen) return null

  const unreadNotificationsCount = notifications.filter((n) => !n.is_read).length
  const unreadNewsCount = inboxAnnouncements.filter((a) => !a.is_read).length

  const handleMarkAllRead = () => {
    markReadMutation.mutate([])
  }

  const handleNotificationClick = (item) => {
    if (!item.is_read) {
      markReadMutation.mutate([item.id])
    }
    onClose()
    if (item.type === 'friend_request' || item.type === 'friend_accept') {
      navigate('/friends')
    } else if (item.type === 'like' || item.type === 'comment') {
      if (item.entity_id) {
        navigate(`/feed?entry=${item.entity_id}`)
      } else {
        navigate('/feed')
      }
    } else if (item.entity_id) {
      navigate(`/feed?entry=${item.entity_id}`)
    }
  }

  const handleAnnouncementClick = (item) => {
    if (!item.is_read) {
      markAnnouncementReadMutation.mutate(item.id)
    }
  }

  const handleAnnouncementCTA = (item, e) => {
    e.stopPropagation()
    if (!item.is_read) {
      markAnnouncementReadMutation.mutate(item.id)
    }
    onClose()
    if (!item.cta_url) return
    if (item.cta_url.startsWith('http://') || item.cta_url.startsWith('https://')) {
      window.open(item.cta_url, '_blank', 'noopener,noreferrer')
    } else {
      navigate(item.cta_url)
    }
  }

  const renderContent = (item) => {
    const actorName = item.actor_display_name || item.actor_username || t('common.user', 'User')
    switch (item.type) {
      case 'friend_request':
        return (
          <>
            <span className="font-semibold text-on-surface">{actorName}</span>{' '}
            {t('notifications.friendRequestSent', { name: '' }).trim()}
          </>
        )
      case 'friend_accept':
        return (
          <>
            <span className="font-semibold text-on-surface">{actorName}</span>{' '}
            {t('notifications.friendRequestAccepted', { name: '' }).trim()}
          </>
        )
      case 'like':
        return (
          <>
            <span className="font-semibold text-on-surface">{actorName}</span>{' '}
            {t('notifications.likedEntry', { name: '' }).trim()}
          </>
        )
      case 'comment':
        return (
          <>
            <span className="font-semibold text-on-surface">{actorName}</span>{' '}
            {t('notifications.commentedEntry', { name: '' }).trim()} &quot;{item.content}&quot;
          </>
        )
      default:
        return item.content || t('notifications.title', 'Notifications')
    }
  }

  const getTypeIcon = (type) => {
    switch (type) {
      case 'friend_request':
        return 'person_add'
      case 'friend_accept':
        return 'group_add'
      case 'like':
        return 'favorite'
      case 'comment':
        return 'chat_bubble'
      default:
        return 'notifications'
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 pt-12 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('notifications.title', 'Notifications')}
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[85vh] w-full max-w-md flex-col rounded-3xl bg-surface-container-lowest shadow-2xl overflow-hidden mx-container-margin"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant/30 px-lg py-md">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary">notifications</span>
            <h2 className="text-title-medium font-title-medium text-on-surface">
              {t('notifications.title', 'Notifications')}
            </h2>
          </div>
          <div className="flex items-center gap-xs">
            {activeTab === 'notifications' && notifications.length > 0 && unreadNotificationsCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={markReadMutation.isPending}
                className="text-label-medium font-label-medium text-primary hover:underline mr-1"
              >
                {t('notifications.markAllRead', 'Mark all read')}
              </button>
            )}
            <button
              type="button"
              aria-label={t('notificationSettings.title', 'Settings')}
              onClick={() => setShowSettingsModal(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">tune</span>
            </button>
            <button
              type="button"
              aria-label={t('common.close', 'Close')}
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-outline-variant/30 px-lg pt-2 gap-4 bg-surface-container-lowest">
          <button
            type="button"
            onClick={() => setActiveTab('notifications')}
            className={`pb-3 text-label-large font-semibold transition-all relative flex items-center gap-1.5 ${
              activeTab === 'notifications'
                ? 'text-primary border-b-2 border-primary'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span>{t('notifications.tabActivity', 'Activity')}</span>
            {unreadNotificationsCount > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-label-small font-bold text-primary">
                {unreadNotificationsCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('news')}
            className={`pb-3 text-label-large font-semibold transition-all relative flex items-center gap-1.5 ${
              activeTab === 'news'
                ? 'text-primary border-b-2 border-primary'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span>{t('notifications.tabNews', 'Announcements')}</span>
            {unreadNewsCount > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-label-small font-bold text-primary">
                {unreadNewsCount}
              </span>
            )}
          </button>
        </div>

        {/* Push permission banner */}
        {pushState.supported && activeTab === 'notifications' && (
          <div className="flex items-center justify-between gap-sm border-b border-outline-variant/20 bg-surface-container-low px-lg py-sm">
            <div className="flex items-center gap-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">
                {pushState.subscribed ? 'notifications_active' : 'notifications_off'}
              </span>
              <span className="text-label-medium">
                {pushState.subscribed
                  ? t('notifications.pushEnabled', 'Push enabled')
                  : pushState.permission === 'denied'
                  ? t('notifications.pushPermissionDenied', 'Push blocked')
                  : t('notifications.enablePush', 'Enable push')}
              </span>
            </div>
            <div className="flex items-center gap-xs">
              {pushState.subscribed && (
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(true)}
                  className="px-2.5 py-1 rounded-full text-label-small font-semibold text-primary hover:bg-primary/10 transition-colors"
                >
                  {t('notificationSettings.configure', 'Settings')}
                </button>
              )}
              {pushState.permission !== 'denied' && (
                <button
                  type="button"
                  onClick={handleTogglePush}
                  disabled={pushState.loading}
                  className="px-3 py-1 rounded-full text-label-small font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                >
                  {pushState.loading
                    ? t('common.loading', 'Loading...')
                    : pushState.subscribed
                    ? t('common.disable', 'Disable')
                    : t('notifications.enablePush', 'Enable')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-md space-y-sm">
          {activeTab === 'notifications' ? (
            isLoading ? (
              <NotificationSkeleton />
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-xl text-center">
                <span className="material-symbols-outlined text-[48px] text-outline-variant mb-sm">
                  notifications_off
                </span>
                <p className="text-body-medium font-body-medium text-on-surface-variant">
                  {t('notifications.empty', 'No notifications yet')}
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNotificationClick(item)}
                  className={`w-full flex items-start gap-md p-md rounded-2xl text-left transition-colors ${
                    item.is_read
                      ? 'bg-surface-container-lowest hover:bg-surface-container-low'
                      : 'bg-primary-container/20 hover:bg-primary-container/30'
                  }`}
                >
                  <div className="relative shrink-0">
                    {item.actor_avatar_url ? (
                      <img
                        src={item.actor_avatar_url}
                        alt={item.actor_display_name || item.actor_username || ''}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container font-semibold">
                        {(item.actor_display_name || item.actor_username || '?')[0].toUpperCase()}
                      </div>
                    )}
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-surface-container-lowest shadow-xs text-primary">
                      <span className="material-symbols-outlined text-[12px]">
                        {getTypeIcon(item.type)}
                      </span>
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-body-medium text-on-surface-variant leading-snug">
                      {renderContent(item)}
                    </p>
                    <span className="mt-1 block text-label-small text-outline">
                      {formatRelativeTime(item.created_at, t)}
                    </span>
                  </div>

                  {!item.is_read && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-primary mt-2" />
                  )}
                </button>
              ))
            )
          ) : (
            // Announcements Tab
            isInboxLoading ? (
              <NotificationSkeleton />
            ) : inboxAnnouncements.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-xl text-center">
                <span className="material-symbols-outlined text-[48px] text-outline-variant mb-sm">
                  campaign
                </span>
                <p className="text-body-medium font-body-medium text-on-surface-variant">
                  {t('notifications.noNews', 'No announcements yet')}
                </p>
              </div>
            ) : (
              inboxAnnouncements.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleAnnouncementClick(item)}
                  className={`w-full flex flex-col gap-2 p-4 rounded-2xl text-left transition-colors border ${
                    item.is_read
                      ? 'bg-surface-container-lowest border-outline-variant/20 hover:bg-surface-container-low'
                      : 'bg-primary-container/15 border-primary/30 hover:bg-primary-container/25'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-label-small font-semibold border ${
                          severityBadgeStyles[item.severity] || severityBadgeStyles.info
                        }`}
                      >
                        {item.severity}
                      </span>
                      {item.is_pinned && (
                        <span className="flex items-center text-primary text-label-small gap-0.5">
                          <span className="material-symbols-outlined text-[14px]">push_pin</span>
                          Pinned
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-label-small text-outline">
                        {formatRelativeTime(item.published_at || item.created_at, t)}
                      </span>
                      {!item.is_read && (
                        <span className="h-2 w-2 rounded-full bg-primary" />
                      )}
                    </div>
                  </div>

                  <h3 className="text-title-small font-bold text-on-surface">{item.title}</h3>
                  <p className="text-body-medium text-on-surface-variant whitespace-pre-wrap">
                    {item.body}
                  </p>

                  {item.cta_label && item.cta_url && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={(e) => handleAnnouncementCTA(item, e)}
                        className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-label-sm font-semibold text-on-primary shadow-xs hover:bg-primary/90 active:scale-95 transition-all"
                      >
                        <span>{item.cta_label}</span>
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            )
          )}
        </div>
      </div>
      <NotificationSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </div>
  )
}
