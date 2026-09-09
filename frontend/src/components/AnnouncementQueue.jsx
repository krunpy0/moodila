import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useActivePromptQuery,
  useAcknowledgeAnnouncementMutation,
  useDismissAnnouncementMutation,
} from '../api/queries'
import { useModalKeyboard } from '../hooks/useModalKeyboard'
import { useLanguage } from '../context/LanguageContext'

const severityConfig = {
  critical: {
    icon: 'report',
    colorClass: 'text-error',
    bgClass: 'bg-error-container/30',
    borderClass: 'border-error/30',
  },
  warning: {
    icon: 'warning',
    colorClass: 'text-amber-600 dark:text-amber-400',
    bgClass: 'bg-tertiary-container/30',
    borderClass: 'border-amber-500/30',
  },
  info: {
    icon: 'info',
    colorClass: 'text-primary',
    bgClass: 'bg-primary-container/30',
    borderClass: 'border-primary/20',
  },
}

export default function AnnouncementQueue() {
  const { data: item } = useActivePromptQuery()
  const acknowledgeMutation = useAcknowledgeAnnouncementMutation()
  const dismissMutation = useDismissAnnouncementMutation()
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const modalRef = useRef(null)
  const navigate = useNavigate()
  const { t } = useLanguage()

  const isCritical = item?.severity === 'critical'
  const isDirectModal = item?.display_type === 'modal'
  const showModal = Boolean(item && (isDirectModal || detailModalOpen))

  const handleModalAcknowledge = () => {
    if (!item) return
    setDetailModalOpen(false)
    acknowledgeMutation.mutate(item.id)
  }

  const handleCloseDetailModal = () => {
    setDetailModalOpen(false)
  }

  const handleBannerDismiss = (e) => {
    e?.stopPropagation?.()
    if (!item) return
    dismissMutation.mutate(item.id)
  }

  const handleAction = (url) => {
    if (!item) return
    setDetailModalOpen(false)
    acknowledgeMutation.mutate(item.id)
    if (!url) return
    if (url.startsWith('http://') || url.startsWith('https://')) {
      window.open(url, '_blank', 'noopener,noreferrer')
    } else {
      navigate(url)
    }
  }

  // Escape key support for modal
  useModalKeyboard(
    () => {
      if (!isCritical) {
        if (isDirectModal) {
          handleModalAcknowledge()
        } else {
          handleCloseDetailModal()
        }
      }
    },
    showModal,
    modalRef,
  )

  if (!item) {
    return null
  }

  const config = severityConfig[item.severity] || severityConfig.info

  return (
    <>
      {/* 1. Floating Banner Mode (Compact Teaser with uncrowded layout) */}
      {item.display_type === 'banner' && !detailModalOpen && (
        <div className="fixed top-4 inset-x-4 max-w-lg mx-auto z-50 animate-in slide-in-from-top-4 duration-300">
          <div
            onClick={() => setDetailModalOpen(true)}
            className={`p-3.5 sm:p-4 rounded-2xl bg-surface-container-lowest text-on-surface shadow-modal border ${config.borderClass} backdrop-blur-md cursor-pointer hover:bg-surface-container-low transition-all`}
          >
            {/* Header row: Icon + Title + Close Button */}
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full ${config.bgClass}`}>
                  <span className={`material-symbols-outlined text-[18px] sm:text-[20px] ${config.colorClass}`}>
                    {config.icon}
                  </span>
                </div>
                <h4 className="text-title-small font-bold text-on-surface truncate">
                  {item.title}
                </h4>
              </div>

              <button
                type="button"
                onClick={handleBannerDismiss}
                aria-label={t('common.close', 'Close')}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors -mr-1 -mt-0.5"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Body preview: Line clamped, never horizontally squished */}
            <div className="mt-1.5 pl-10 sm:pl-11 text-body-sm text-on-surface-variant">
              <p className="line-clamp-2 leading-relaxed break-words">
                {item.body}
              </p>
              {item.body.length > 70 && (
                <span className="inline-flex items-center gap-0.5 text-label-small font-semibold text-primary mt-1 hover:underline">
                  {t('common.seeMore', 'See more')}
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </span>
              )}
            </div>

            {/* Bottom row: CTA button if available */}
            {item.cta_label && item.cta_url && (
              <div className="mt-2.5 pl-10 sm:pl-11 flex items-center justify-start">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleAction(item.cta_url)
                  }}
                  className="rounded-xl bg-primary px-3 py-1.5 text-label-sm font-semibold text-on-primary shadow-xs hover:bg-primary/90 active:scale-95 transition-all flex items-center gap-1"
                >
                  <span>{item.cta_label}</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Full Modal Dialog (for native modal or expanded from banner) */}
      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="announcement-title"
          onClick={isCritical ? undefined : (isDirectModal ? handleModalAcknowledge : handleCloseDetailModal)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/56 p-container-margin backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div
            ref={modalRef}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl lg:rounded-xxl bg-surface-container-lowest p-6 shadow-modal flex flex-col gap-4 border border-outline-variant/20 max-h-[85vh]"
          >
            {/* Modal Header */}
            <div className="flex items-start gap-3 w-full">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${config.bgClass}`}>
                <span className={`material-symbols-outlined text-[28px] ${config.colorClass}`}>
                  {config.icon}
                </span>
              </div>
              <div className="min-w-0 flex-1 pt-1">
                <h2
                  id="announcement-title"
                  className="text-title-large font-bold text-on-surface break-words leading-tight"
                >
                  {item.title}
                </h2>
              </div>
              {!isCritical && (
                <button
                  type="button"
                  onClick={isDirectModal ? handleModalAcknowledge : handleCloseDetailModal}
                  aria-label={t('common.close', 'Close')}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors -mr-1 -mt-1"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              )}
            </div>

            {/* Scrollable Body Text with generous spacing */}
            <div className="flex-1 overflow-y-auto pr-1 text-body-md text-on-surface-variant whitespace-pre-wrap leading-relaxed text-left border-y border-outline-variant/15 py-3 space-y-2">
              {item.body}
            </div>

            {/* Sticky Action Footer */}
            <div className="w-full flex flex-col gap-2 pt-1 shrink-0">
              {item.cta_label && item.cta_url && (
                <button
                  type="button"
                  onClick={() => handleAction(item.cta_url)}
                  className="h-12 w-full rounded-2xl bg-primary text-label-lg font-semibold text-on-primary shadow-card hover:bg-primary/90 active:scale-[0.99] transition-all flex items-center justify-center gap-1.5"
                >
                  <span>{item.cta_label}</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleModalAcknowledge}
                className={`h-12 w-full rounded-2xl text-label-lg font-semibold transition-all active:scale-[0.99] ${
                  item.cta_label && item.cta_url
                    ? 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                    : 'bg-primary text-on-primary shadow-card hover:bg-primary/90'
                }`}
              >
                {t('common.gotIt', 'Got it')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
