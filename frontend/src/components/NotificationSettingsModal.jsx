import { useRef, useState, useEffect } from 'react'
import { useNotificationSettingsQuery, useUpdateNotificationSettingsMutation } from '../api/queries'
import { getPushSubscriptionState, subscribeToPushNotifications, unsubscribeFromPushNotifications } from '../api/push'
import { useLanguage } from '../context/LanguageContext'
import { useModalKeyboard } from '../hooks/useModalKeyboard'
import { useNotifications } from './Notifications'

export default function NotificationSettingsModal({ isOpen, onClose }) {
  const { t } = useLanguage()
  const { notify } = useNotifications()
  const modalRef = useRef(null)

  const { data: settings, isLoading, error } = useNotificationSettingsQuery(isOpen)
  const updateMutation = useUpdateNotificationSettingsMutation()

  const [pushState, setPushState] = useState({
    supported: true,
    subscribed: false,
    permission: 'default',
    loading: false,
  })

  useModalKeyboard(onClose, isOpen, modalRef)

  useEffect(() => {
    if (!isOpen) return
    getPushSubscriptionState().then((state) => {
      setPushState((prev) => ({ ...prev, ...state }))
    })
  }, [isOpen])

  if (!isOpen) return null

  const handleTogglePushPermission = async () => {
    setPushState((prev) => ({ ...prev, loading: true }))
    try {
      if (pushState.subscribed) {
        await unsubscribeFromPushNotifications()
        setPushState((prev) => ({ ...prev, subscribed: false, loading: false }))
        notify(t('notificationSettings.pushDisabledToast', 'Push-уведомления отключены'))
      } else {
        await subscribeToPushNotifications()
        setPushState((prev) => ({ ...prev, subscribed: true, permission: 'granted', loading: false }))
        notify(t('notificationSettings.pushEnabledToast', 'Push-уведомления подключены'))
      }
    } catch (err) {
      setPushState((prev) => ({ ...prev, loading: false }))
      notify(err.message || t('common.error'), 'error')
    }
  }

  const handleToggleSetting = (key) => {
    if (!settings) return
    const currentVal = settings[key] !== false
    const nextVal = !currentVal

    updateMutation.mutate(
      { [key]: nextVal },
      {
        onError: (err) => {
          notify(err.message || t('common.error'), 'error')
        },
      }
    )
  }

  const settingItems = [
    {
      key: 'notify_new_posts',
      icon: 'article',
      title: t('notificationSettings.newPostsTitle', 'Новые записи друзей'),
      desc: t('notificationSettings.newPostsDesc', 'Уведомлять, когда друзья делятся новой записью'),
      enabled: settings?.notify_new_posts !== false,
    },
    {
      key: 'notify_reactions',
      icon: 'favorite',
      title: t('notificationSettings.reactionsTitle', 'Реакции'),
      desc: t('notificationSettings.reactionsDesc', 'Когда кто-то ставит реакцию на вашу запись'),
      enabled: settings?.notify_reactions !== false,
    },
    {
      key: 'notify_comments',
      icon: 'chat_bubble',
      title: t('notificationSettings.commentsTitle', 'Комментарии'),
      desc: t('notificationSettings.commentsDesc', 'Когда кто-то оставляет комментарий к вашей записи'),
      enabled: settings?.notify_comments !== false,
    },
    {
      key: 'notify_friend_requests',
      icon: 'person_add',
      title: t('notificationSettings.friendRequestsTitle', 'Заявки в друзья'),
      desc: t('notificationSettings.friendRequestsDesc', 'Входящие заявки и подтверждения дружбы'),
      enabled: settings?.notify_friend_requests !== false,
    },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-container-margin backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-settings-modal-title"
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[85vh] flex flex-col rounded-[24px] bg-surface-container-lowest p-lg cloud-shadow space-y-md overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-primary">
              <span className="material-symbols-outlined text-[22px]">tune</span>
            </div>
            <div>
              <h2
                id="notification-settings-modal-title"
                className="text-headline-lg-mobile font-semibold text-on-surface"
              >
                {t('notificationSettings.title', 'Push-уведомления')}
              </h2>
              <p className="text-body-sm text-on-surface-variant">
                {t('notificationSettings.subtitle', 'Настройка типов уведомлений')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Master Web Push Status Banner */}
        {pushState.supported && (
          <div className="rounded-2xl bg-surface-container-low p-md border border-outline-variant/15 flex items-center justify-between gap-sm">
            <div className="flex items-center gap-sm min-w-0">
              <span
                className={`material-symbols-outlined text-[22px] ${
                  pushState.subscribed ? 'text-primary' : 'text-outline'
                }`}
              >
                {pushState.subscribed ? 'notifications_active' : 'notifications_off'}
              </span>
              <div className="min-w-0">
                <p className="text-label-md font-semibold text-on-surface truncate">
                  {pushState.subscribed
                    ? t('notifications.pushEnabled', 'Push-уведомления активны')
                    : pushState.permission === 'denied'
                    ? t('notifications.pushPermissionDenied', 'Уведомления заблокированы в браузере')
                    : t('notifications.enablePush', 'Включить Push-уведомления')}
                </p>
                <p className="text-body-xs text-on-surface-variant truncate">
                  {pushState.subscribed
                    ? t('notificationSettings.pushActiveDesc', 'Браузер подписан на уведомления')
                    : t('notificationSettings.pushInactiveDesc', 'Требуется разрешение браузера')}
                </p>
              </div>
            </div>
            {pushState.permission !== 'denied' && (
              <button
                type="button"
                onClick={handleTogglePushPermission}
                disabled={pushState.loading}
                className={`shrink-0 rounded-full px-md py-1.5 text-label-sm font-semibold transition-all active:scale-95 disabled:opacity-50 ${
                  pushState.subscribed
                    ? 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
                    : 'bg-primary text-on-primary hover:opacity-90 shadow-xs'
                }`}
              >
                {pushState.loading
                  ? t('common.loading', '...')
                  : pushState.subscribed
                  ? t('common.disable', 'Отключить')
                  : t('common.enable', 'Включить')}
              </button>
            )}
          </div>
        )}

        {/* Toggles list */}
        <div className="flex-1 overflow-y-auto space-y-sm pr-1 -mr-1">
          {isLoading ? (
            <div className="py-8 text-center text-body-sm text-on-surface-variant">
              {t('common.loading')}
            </div>
          ) : error ? (
            <div className="rounded-xl bg-error-container p-sm text-body-sm text-on-error-container">
              {error.message || t('common.error')}
            </div>
          ) : (
            settingItems.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between gap-sm rounded-2xl bg-surface-container-low p-md transition-colors hover:bg-surface-container"
              >
                <div className="flex items-center gap-sm min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
                    <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-body-md font-semibold text-on-surface">{item.title}</p>
                    <p className="text-body-xs text-on-surface-variant">{item.desc}</p>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={item.enabled}
                  aria-label={item.title}
                  onClick={() => handleToggleSetting(item.key)}
                  disabled={updateMutation.isPending}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 ${
                    item.enabled ? 'bg-primary' : 'bg-surface-container-highest'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      item.enabled ? 'translate-x-5' : 'translate-x-0.5'
                    } mt-0.5`}
                  />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
