import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotificationsQuery, useMarkNotificationsAsReadMutation } from '../api/queries'
import { useLanguage } from '../context/LanguageContext'
import { getPushSubscriptionState, subscribeToPushNotifications, unsubscribeFromPushNotifications } from '../api/push'
import { NotificationSkeleton } from './skeleton/PageSkeletons'

function formatRelativeTime(dateString, t) {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now - date) / 1000)

  if (seconds < 60) return t('notifications.justNow')
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return t('notifications.minutesAgo', { m: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('notifications.hoursAgo', { h: hours })
  const days = Math.floor(hours / 24)
  if (days < 30) return t('notifications.daysAgo', { d: days })
  return date.toLocaleDateString()
}

export default function NotificationCenterModal({ isOpen, onClose }) {
  const navigate = useNavigate()
  const { data: notifications = [], isLoading } = useNotificationsQuery(isOpen)
  const markReadMutation = useMarkNotificationsAsReadMutation()
  const { t } = useLanguage()
  const [pushState, setPushState] = useState({ supported: true, subscribed: false, permission: 'default', loading: false, error: '' })

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
    }
  }

  const renderContent = (item) => {
    switch (item.type) {
      case 'friend_request':
        return (
          <>
            <span className="font-semibold text-on-surface">{item.actor_display_name}</span>{' '}
            {t('notifications.friendRequestSent', { name: '' }).trim()}
          </>
        )
      case 'friend_accept':
        return (
          <>
            <span className="font-semibold text-on-surface">{item.actor_display_name}</span>{' '}
            {t('notifications.friendRequestAccepted', { name: '' }).trim()}
          </>
        )
      case 'like':
        return (
          <>
            <span className="font-semibold text-on-surface">{item.actor_display_name}</span>{' '}
            {t('notifications.likedEntry', { name: '' }).trim()}
          </>
        )
      case 'comment':
        return (
          <>
            <span className="font-semibold text-on-surface">{item.actor_display_name}</span>{' '}
            {t('notifications.commentedEntry', { name: '' }).trim()} &quot;{item.content}&quot;
          </>
        )
      default:
        return item.content || t('notifications.title')
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

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 pt-12 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div className="relative flex max-h-[85vh] w-full max-w-md flex-col rounded-3xl bg-surface-container-lowest shadow-2xl overflow-hidden mx-container-margin">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant/30 px-lg py-md">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary">notifications</span>
            <h2 className="text-title-medium font-title-medium text-on-surface">
              {t('notifications.title')}
            </h2>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-label-small font-bold text-primary">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-xs">
            {notifications.length > 0 && unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={markReadMutation.isPending}
                className="text-label-medium font-label-medium text-primary hover:underline"
              >
                {t('notifications.markAllRead')}
              </button>
            )}
            <button
              type="button"
              aria-label={t('common.close')}
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Push Notification Toggle Banner */}
        {pushState.supported && (
          <div className="bg-surface-container-low px-lg py-sm flex items-center justify-between border-b border-outline-variant/20 text-body-small text-on-surface-variant">
            <div className="flex items-center gap-xs">
              <span className={`material-symbols-outlined text-[18px] ${pushState.subscribed ? 'text-primary' : 'text-outline'}`}>
                {pushState.subscribed ? 'notifications_active' : 'notifications_paused'}
              </span>
              <span className="text-label-medium">
                {pushState.subscribed
                  ? t('notifications.pushEnabled')
                  : pushState.permission === 'denied'
                  ? t('notifications.pushPermissionDenied')
                  : t('notifications.enablePush')}
              </span>
            </div>
            {pushState.permission !== 'denied' && (
              <button
                type="button"
                onClick={handleTogglePush}
                disabled={pushState.loading}
                className="px-3 py-1 rounded-full text-label-small font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
              >
                {pushState.loading
                  ? t('common.loading')
                  : pushState.subscribed
                  ? (t('common.disable') || 'Выключить')
                  : t('notifications.enablePush')}
              </button>
            )}
          </div>
        )}

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-md space-y-sm">
          {isLoading ? (
            <NotificationSkeleton />
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-xl text-center">
              <span className="material-symbols-outlined text-[48px] text-outline-variant mb-sm">
                notifications_off
              </span>
              <p className="text-body-medium font-body-medium text-on-surface-variant">
                {t('notifications.empty')}
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
                {/* Actor avatar / icon */}
                <div className="relative shrink-0">
                  {item.actor_avatar_url ? (
                    <img
                      src={item.actor_avatar_url}
                      alt={item.actor_display_name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container font-semibold">
                      {item.actor_display_name ? item.actor_display_name[0].toUpperCase() : '?'}
                    </div>
                  )}
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-surface-container-lowest shadow-xs text-primary">
                    <span className="material-symbols-outlined text-[12px]">
                      {getTypeIcon(item.type)}
                    </span>
                  </span>
                </div>

                {/* Main text */}
                <div className="flex-1 min-w-0">
                  <p className="text-body-medium text-on-surface-variant leading-snug">
                    {renderContent(item)}
                  </p>
                  <span className="mt-1 block text-label-small text-outline">
                    {formatRelativeTime(item.created_at, t)}
                  </span>
                </div>

                {/* Unread indicator */}
                {!item.is_read && (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-primary mt-2" />
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
