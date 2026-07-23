import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const NotificationsContext = createContext(null)

let notifyFromOutside = null

export function notifyError(error) {
  const message = error?.message || 'Something went wrong. Please try again.'
  notifyFromOutside?.(message, 'error')
}

export function NotificationsProvider({ children }) {
  const [notifications, setNotifications] = useState([])

  const notify = useCallback((message, type = 'success') => {
    const id = `${Date.now()}-${Math.random()}`
    setNotifications((current) => [...current, { id, message, type }])
    window.setTimeout(() => {
      setNotifications((current) => current.filter((item) => item.id !== id))
    }, 4500)
  }, [])

  notifyFromOutside = notify

  const value = useMemo(() => ({ notify }), [notify])
  const dismiss = (id) => setNotifications((current) => current.filter((item) => item.id !== id))

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] mx-auto flex w-full max-w-md flex-col gap-sm px-container-margin" aria-live="polite" aria-atomic="true">
        {notifications.map(({ id, message, type }) => (
          <div key={id} role={type === 'error' ? 'alert' : 'status'} className={`pointer-events-auto flex items-center gap-sm rounded-2xl px-md py-sm shadow-lg ${type === 'error' ? 'bg-error-container text-on-error-container' : 'bg-primary-container text-on-primary-container'}`}>
            <span className="material-symbols-outlined" aria-hidden="true">{type === 'error' ? 'error' : 'check_circle'}</span>
            <p className="min-w-0 flex-1 text-body-sm font-body-sm">{message}</p>
            <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(id)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-black/5">
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
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
