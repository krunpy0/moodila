import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { useBlockedUsersQuery, useUnblockUserMutation } from '../api/queries'
import { useNotifications } from './Notifications'
import { useLanguage } from '../context/LanguageContext'
import { useModalKeyboard } from '../hooks/useModalKeyboard'
import { haptics } from '../utils/haptics'

export default function BlockedUsersModal({ isOpen, onClose }) {
  const { data: blockedUsers = [], isLoading } = useBlockedUsersQuery(isOpen)
  const unblockMutation = useUnblockUserMutation()
  const { notify } = useNotifications()
  const { language } = useLanguage()
  const modalRef = useRef(null)

  useModalKeyboard(onClose, isOpen, modalRef)

  if (!isOpen) return null

  const isRu = language === 'ru'

  const handleUnblock = (userId, username) => {
    haptics.impact()
    unblockMutation.mutate(userId, {
      onSuccess: () => {
        haptics.success()
        notify(isRu ? `@${username} разблокирован` : `@${username} unblocked`)
      },
      onError: (err) => {
        haptics.error()
        notify(err?.message || (isRu ? 'Ошибка' : 'Error'), 'error')
      },
    })
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim/40 backdrop-blur-sm animate-fade-in">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="blocked-users-title"
        className="w-full max-w-md max-h-[80vh] flex flex-col rounded-2xl bg-surface-container-lowest border border-outline-variant/30 p-5 shadow-floating"
      >
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px] text-on-surface-variant">block</span>
            <h2 id="blocked-users-title" className="text-title-md font-bold text-on-surface">
              {isRu ? 'Заблокированные пользователи' : 'Blocked Users'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3 space-y-2">
          {isLoading ? (
            <div className="py-8 text-center text-on-surface-variant text-body-sm">
              {isRu ? 'Загрузка...' : 'Loading...'}
            </div>
          ) : blockedUsers.length === 0 ? (
            <div className="py-8 text-center text-on-surface-variant text-body-sm">
              {isRu ? 'Список заблокированных пуст' : 'No blocked users'}
            </div>
          ) : (
            blockedUsers.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-outline-variant/20 bg-surface-container-low"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-9 w-9 shrink-0 rounded-full bg-surface-container-highest flex items-center justify-center overflow-hidden font-bold text-on-surface-variant text-label-md">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (u.display_name || u.username || '?')[0].toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-body-sm font-bold text-on-surface truncate">
                      {u.display_name || u.username}
                    </p>
                    <p className="text-label-sm text-on-surface-variant truncate">
                      @{u.username}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleUnblock(u.id, u.username)}
                  disabled={unblockMutation.isPending}
                  className="px-3 py-1.5 rounded-lg border border-outline-variant/40 hover:bg-surface-container text-label-sm font-semibold text-on-surface shrink-0 disabled:opacity-50"
                >
                  {isRu ? 'Разблокировать' : 'Unblock'}
                </button>
              </div>
            ))
          )}
        </div>

        <div className="pt-3 border-t border-outline-variant/20 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-body-sm font-semibold text-on-surface"
          >
            {isRu ? 'Закрыть' : 'Close'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
