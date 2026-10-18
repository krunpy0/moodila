import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useReportContentMutation } from '../api/queries'
import { useNotifications } from './Notifications'
import { useLanguage } from '../context/LanguageContext'
import { useModalKeyboard } from '../hooks/useModalKeyboard'
import { haptics } from '../utils/haptics'

const REASONS = [
  { id: 'spam', labelRu: 'Спам или реклама', labelEn: 'Spam or advertising' },
  { id: 'harassment', labelRu: 'Оскорбления или травля', labelEn: 'Harassment or bullying' },
  { id: 'inappropriate_content', labelRu: 'Неприемлемый контент', labelEn: 'Inappropriate content' },
  { id: 'other', labelRu: 'Другое', labelEn: 'Other' },
]

export default function ReportModal({ isOpen, onClose, reportedUserId, entityType, entityId }) {
  const [reason, setReason] = useState('spam')
  const [details, setDetails] = useState('')
  const reportMutation = useReportContentMutation()
  const { notify } = useNotifications()
  const { language } = useLanguage()
  const modalRef = useRef(null)

  useModalKeyboard(onClose, isOpen, modalRef)

  if (!isOpen) return null

  const isRu = language === 'ru'

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!reportedUserId) return
    haptics.impact()
    reportMutation.mutate(
      {
        reported_user_id: reportedUserId,
        entity_type: entityType || 'entry',
        entity_id: entityId || null,
        reason,
        details,
      },
      {
        onSuccess: () => {
          haptics.success()
          notify(isRu ? 'Жалоба отправлена на модерацию' : 'Report submitted for review')
          onClose()
        },
        onError: (err) => {
          haptics.error()
          notify(err?.message || (isRu ? 'Ошибка при отправке' : 'Submission error'), 'error')
        },
      }
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim/40 backdrop-blur-sm animate-fade-in">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
        className="w-full max-w-sm rounded-2xl bg-surface-container-lowest border border-outline-variant/30 p-5 shadow-floating space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-error">
            <span className="material-symbols-outlined text-[20px]">report</span>
            <h2 id="report-modal-title" className="text-title-md font-bold text-on-surface">
              {isRu ? 'Пожаловаться' : 'Report Content'}
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-label-sm font-semibold text-on-surface-variant block">
              {isRu ? 'Причина жалобы' : 'Reason'}
            </label>
            <div className="space-y-1.5">
              {REASONS.map((r) => (
                <label
                  key={r.id}
                  className={`flex items-center gap-2.5 p-2 rounded-xl border text-body-sm cursor-pointer transition-colors ${
                    reason === r.id
                      ? 'border-primary bg-primary/5 font-semibold text-on-surface'
                      : 'border-outline-variant/20 hover:bg-surface-container-low text-on-surface-variant'
                  }`}
                >
                  <input
                    type="radio"
                    name="report_reason"
                    value={r.id}
                    checked={reason === r.id}
                    onChange={() => setReason(r.id)}
                    className="accent-primary"
                  />
                  <span>{isRu ? r.labelRu : r.labelEn}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-label-sm font-semibold text-on-surface-variant block">
              {isRu ? 'Подробности (необязательно)' : 'Details (optional)'}
            </label>
            <textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={isRu ? 'Опишите проблему подробнее...' : 'Describe what happened...'}
              className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low p-2.5 text-body-sm text-on-surface focus:outline-none focus:border-primary resize-none"
            />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={reportMutation.isPending}
              className="px-4 py-2 rounded-xl text-body-sm font-semibold text-on-surface-variant hover:bg-surface-container"
            >
              {isRu ? 'Отмена' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={reportMutation.isPending}
              className="px-4 py-2 rounded-xl bg-error text-on-error text-body-sm font-bold shadow-subtle hover:opacity-90 disabled:opacity-50"
            >
              {reportMutation.isPending
                ? isRu ? 'Отправка...' : 'Sending...'
                : isRu ? 'Отправить' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
