import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const NotificationsContext = createContext(null)

let notifyFromOutside = null

export function notifyError(error) {
  const message = error?.message || 'Something went wrong. Please try again.'
  notifyFromOutside?.(message, 'error')
}

export function notifySuccess(message) {
  notifyFromOutside?.(message, 'success')
}

export function notifyInfo(message) {
  notifyFromOutside?.(message, 'info')
}

export function NotificationsProvider({ children }) {
  const [notifications, setNotifications] = useState([])

  const dismiss = useCallback((id) => {
    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, isExiting: true } : item))
    )
    window.setTimeout(() => {
      setNotifications((current) => current.filter((item) => item.id !== id))
    }, 200)
  }, [])

  const notify = useCallback(
    (message, type = 'success') => {
      const id = `${Date.now()}-${Math.random()}`
      setNotifications((current) => [...current, { id, message, type, isExiting: false }])
      window.setTimeout(() => {
        dismiss(id)
      }, 4500)
    },
    [dismiss]
  )

  notifyFromOutside = notify

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-4 z-[100] mx-auto flex w-full max-w-md flex-col gap-sm px-container-margin"
        aria-live="polite"
        aria-atomic="true"
      >
        {notifications.map(({ id, message, type, isExiting }) => (
          <div
            key={id}
            role={type === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-center gap-sm rounded-2xl px-md py-sm shadow-lg transition-all ${
              isExiting
                ? 'animate-out fade-out slide-out-to-top-4 duration-200'
                : 'animate-in slide-in-from-top-4 fade-in duration-300'
            } ${
              type === 'error'
                ? 'bg-error-container text-on-error-container'
                : type === 'info'
                ? 'bg-slate-800 text-slate-100 border border-slate-700'
                : 'bg-primary-container text-on-primary-container'
            }`}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {type === 'error' ? 'error' : type === 'info' ? 'info' : 'check_circle'}
            </span>
            <p className="min-w-0 flex-1 text-body-sm font-body-sm">{message}</p>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(id)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                close
              </span>
            </button>
          </div>
        ))}
      </div>
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationsContext)
  if (!context) throw new Error('useNotifications must be used inside NotificationsProvider')
  return context
}
