import { useState } from 'react'
import { useUnreadNotificationCountQuery } from '../api/queries'
import NotificationCenterModal from './NotificationCenterModal'
import { useLanguage } from '../context/LanguageContext'

export default function HeaderBell() {
  const [isOpen, setIsOpen] = useState(false)
  const { data } = useUnreadNotificationCountQuery()
  const { t } = useLanguage()
  const unreadCount = data?.unread_count || 0

  return (
    <>
      <button
        type="button"
        aria-label={t('notifications.title')}
        title={t('notifications.title')}
        onClick={() => setIsOpen(true)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface-variant cloud-shadow transition-transform active:scale-95"
      >
        <span className="material-symbols-outlined text-[20px]">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-on-primary shadow-xs animate-in zoom-in-50">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <NotificationCenterModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
