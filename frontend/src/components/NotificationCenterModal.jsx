import { useNavigate } from 'react-router-dom'
import { useNotificationsQuery, useMarkNotificationsAsReadMutation } from '../api/queries'

function formatRelativeTime(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now - date) / 1000)

  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return date.toLocaleDateString()
}

export default function NotificationCenterModal({ isOpen, onClose }) {
  const navigate = useNavigate()
  const { data: notifications = [], isLoading } = useNotificationsQuery(isOpen)
  const markReadMutation = useMarkNotificationsAsReadMutation()

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
      navigate('/feed')
    }
  }

  const renderContent = (item) => {
    switch (item.type) {
      case 'friend_request':
        return (
          <>
            <span className="font-semibold text-on-surface">{item.actor_display_name}</span> sent you a friend request.
          </>
        )
      case 'friend_accept':
        return (
          <>
            <span className="font-semibold text-on-surface">{item.actor_display_name}</span> accepted your friend request.
          </>
        )
      case 'like':
        return (
          <>
            <span className="font-semibold text-on-surface">{item.actor_display_name}</span> reacted {item.content || '❤️'} to your entry.
          </>
        )
      case 'comment':
        return (
          <>
            <span className="font-semibold text-on-surface">{item.actor_display_name}</span> commented: &quot;{item.content}&quot;
          </>
        )
      default:
        return item.content || 'New notification'
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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-12 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="relative flex max-h-[85vh] w-full max-w-md flex-col rounded-3xl bg-surface-container-lowest shadow-2xl overflow-hidden mx-container-margin">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant/30 px-lg py-md">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary">notifications</span>
            <h2 className="text-title-medium font-title-medium text-on-surface">Notifications</h2>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-label-small font-bold text-primary">
                {unreadCount} new
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
                Mark all read
              </button>
            )}
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-md space-y-sm">
          {isLoading ? (
            <div className="flex items-center justify-center py-xl text-on-surface-variant text-body-medium">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-xl text-center">
              <span className="material-symbols-outlined text-[48px] text-outline-variant mb-sm">notifications_off</span>
              <p className="text-body-medium font-body-medium text-on-surface-variant">No notifications yet</p>
              <p className="text-body-small text-outline">You will see friend requests, likes, and comments here.</p>
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
                    <span className="material-symbols-outlined text-[12px]">{getTypeIcon(item.type)}</span>
                  </span>
                </div>

                {/* Main text */}
                <div className="flex-1 min-w-0">
                  <p className="text-body-medium text-on-surface-variant leading-snug">
                    {renderContent(item)}
                  </p>
                  <span className="mt-1 block text-label-small text-outline">
                    {formatRelativeTime(item.created_at)}
                  </span>
                </div>

                {/* Unread indicator */}
                {!item.is_read && (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-primary mt-2" title="Unread" />
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
