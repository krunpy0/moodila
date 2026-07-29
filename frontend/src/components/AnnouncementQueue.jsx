import { useEffect, useState } from 'react'
import { useMarkAnnouncementReadMutation, useUnreadAnnouncementsQuery } from '../api/queries'

const severityConfig = {
  critical: {
    icon: 'report',
    colorClass: 'text-error',
    bgClass: 'bg-error-container/30',
  },
  warning: {
    icon: 'warning',
    colorClass: 'text-amber-600 dark:text-amber-400',
    bgClass: 'bg-tertiary-container/30',
  },
  info: {
    icon: 'info',
    colorClass: 'text-primary',
    bgClass: 'bg-primary-container/30',
  },
}

export default function AnnouncementQueue() {
  const { data: unreadList } = useUnreadAnnouncementsQuery()
  const markReadMutation = useMarkAnnouncementReadMutation()
  const [queue, setQueue] = useState([])

  useEffect(() => {
    if (unreadList && Array.isArray(unreadList)) {
      setQueue(unreadList)
    }
  }, [unreadList])

  if (!queue || queue.length === 0) {
    return null
  }

  const current = queue[0]
  const config = severityConfig[current.severity] || severityConfig.info

  const handleDismiss = () => {
    markReadMutation.mutate(current.id)
    setQueue((prev) => prev.slice(1))
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="announcement-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-container-margin backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="w-full max-w-sm rounded-[24px] bg-surface-container-lowest p-lg cloud-shadow text-center flex flex-col items-center gap-md border border-outline-variant/20">
        <div className={`flex h-16 w-16 items-center justify-center rounded-full ${config.bgClass}`}>
          <span className={`material-symbols-outlined text-[36px] ${config.colorClass}`}>
            {config.icon}
          </span>
        </div>

        <div className="space-y-xs text-center w-full">
          <h2
            id="announcement-title"
            className="text-headline-lg font-headline-lg text-on-surface font-bold break-words"
          >
            {current.title}
          </h2>
          <p className="text-body-md font-body-md text-on-surface-variant break-words whitespace-pre-wrap">
            {current.body}
          </p>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="mt-xs w-full rounded-full bg-primary px-lg py-sm text-label-lg font-label-lg text-on-primary shadow-md hover:bg-primary/90 active:scale-[0.98] transition-all"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
