import { useState } from 'react'
import { useAdminReportsQuery, useUpdateAdminReportStatusMutation } from '../api/queries'
import { useLanguage } from '../context/LanguageContext'
import { useNotifications } from './Notifications'

export default function AdminReports() {
  const { t } = useLanguage()
  const { notify } = useNotifications()
  const [statusFilter, setStatusFilter] = useState('all')

  const { data, isLoading, isError, error } = useAdminReportsQuery(
    statusFilter === 'all' ? '' : statusFilter
  )
  const updateMutation = useUpdateAdminReportStatusMutation()
  const reports = data?.reports || []

  const handleUpdateStatus = (id, newStatus) => {
    updateMutation.mutate(
      { id, status: newStatus },
      {
        onSuccess: () => {
          notify(t('admin.reportUpdated', 'Статус жалобы обновлен'), 'success')
        },
        onError: (err) => {
          notify(err.message, 'error')
        },
      }
    )
  }

  const getReasonLabel = (reason) => {
    switch (reason) {
      case 'spam':
        return t('reports.reasonSpam', 'Спам')
      case 'harassment':
        return t('reports.reasonHarassment', 'Оскорбления')
      case 'inappropriate_content':
        return t('reports.reasonInappropriate', 'Неприемлемый контент')
      default:
        return t('reports.reasonOther', 'Другое')
    }
  }

  const getEntityLabel = (type) => {
    switch (type) {
      case 'entry':
        return t('reports.entityEntry', 'Запись')
      case 'comment':
        return t('reports.entityComment', 'Комментарий')
      case 'user':
        return t('reports.entityUser', 'Пользователь')
      default:
        return type
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: 'all', label: t('common.all', 'Все') },
          { id: 'pending', label: t('admin.statusPending', 'Ожидают') },
          { id: 'reviewed', label: t('admin.statusReviewed', 'Рассмотрены') },
          { id: 'dismissed', label: t('admin.statusDismissed', 'Отклонены') },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusFilter(tab.id)}
            className={`px-4 py-2 rounded-full text-label-md font-semibold transition-colors ${
              statusFilter === tab.id
                ? 'bg-primary text-on-primary shadow-subtle'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-32 rounded-2xl bg-surface-container-low animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-2xl bg-error-container/30 p-4 border border-error/20 text-error">
          {error?.message || t('common.error', 'Ошибка загрузки')}
        </div>
      )}

      {!isLoading && !isError && reports.length === 0 && (
        <div className="rounded-[24px] bg-surface-container-lowest p-8 text-center border border-outline-variant/20">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-container mx-auto mb-3 text-on-surface-variant">
            <span className="material-symbols-outlined text-[28px]">verified</span>
          </div>
          <h3 className="text-title-md font-bold text-on-surface">
            {t('admin.noReports', 'Жалоб нет')}
          </h3>
          <p className="text-body-sm text-on-surface-variant mt-1">
            {t('admin.noReportsDesc', 'Нет активных обращений в данной категории.')}
          </p>
        </div>
      )}

      {!isLoading && !isError && reports.length > 0 && (
        <div className="space-y-4">
          {reports.map((report) => (
            <div
              key={report.id}
              className="rounded-[24px] bg-surface-container-lowest p-5 sm:p-6 shadow-card border border-outline-variant/20 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/10 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-label-sm font-semibold ${
                      report.status === 'pending'
                        ? 'bg-warning-container text-on-warning-container font-bold ring-1 ring-warning/30'
                        : report.status === 'reviewed'
                        ? 'bg-success/15 text-success'
                        : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    {report.status === 'pending'
                      ? t('admin.statusPending', 'Ожидает')
                      : report.status === 'reviewed'
                      ? t('admin.statusReviewed', 'Рассмотрено')
                      : t('admin.statusDismissed', 'Отклонено')}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-surface-container text-on-surface text-label-sm font-medium">
                    {getEntityLabel(report.entity_type)}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-error-container/30 text-error text-label-sm font-medium">
                    {getReasonLabel(report.reason)}
                  </span>
                </div>
                <span className="text-label-sm text-on-surface-variant tabular-nums">
                  {new Date(report.created_at).toLocaleString([], {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              {/* Users info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-body-sm">
                <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/10">
                  <span className="text-label-xs font-semibold uppercase text-on-surface-variant block mb-1">
                    {t('admin.reporter', 'Кто пожаловался')}
                  </span>
                  <p className="font-semibold text-on-surface truncate">
                    {report.reporter_display_name || report.reporter_username}
                  </p>
                  <p className="text-label-sm text-on-surface-variant truncate">
                    @{report.reporter_username}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/10">
                  <span className="text-label-xs font-semibold uppercase text-on-surface-variant block mb-1">
                    {t('admin.reportedUser', 'На кого жалоба')}
                  </span>
                  <p className="font-semibold text-on-surface truncate">
                    {report.reported_display_name || report.reported_username}
                  </p>
                  <p className="text-label-sm text-on-surface-variant truncate">
                    @{report.reported_username}
                  </p>
                </div>
              </div>

              {/* Details & content snippet */}
              {report.details && (
                <div>
                  <span className="text-label-xs font-semibold text-on-surface-variant block mb-1">
                    {t('admin.reportDetails', 'Комментарий заявителя')}:
                  </span>
                  <p className="text-body-sm text-on-surface bg-surface-container p-3 rounded-xl">
                    {report.details}
                  </p>
                </div>
              )}

              {report.content_snippet && (
                <div>
                  <span className="text-label-xs font-semibold text-on-surface-variant block mb-1">
                    {t('admin.contentSnippet', 'Содержимое объекта')}:
                  </span>
                  <blockquote className="text-body-sm text-on-surface bg-surface-container/60 p-3 rounded-xl border-l-4 border-primary italic">
                    "{report.content_snippet}"
                  </blockquote>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-outline-variant/10">
                {report.status !== 'reviewed' && (
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(report.id, 'reviewed')}
                    disabled={updateMutation.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-success text-on-success text-label-sm font-semibold hover:opacity-90 active:scale-95 transition-all"
                  >
                    <span className="material-symbols-outlined text-[18px]">check</span>
                    <span>{t('admin.markReviewed', 'Принять (Рассмотрено)')}</span>
                  </button>
                )}
                {report.status !== 'dismissed' && (
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(report.id, 'dismissed')}
                    disabled={updateMutation.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-container text-on-surface text-label-sm font-semibold hover:bg-surface-container-high active:scale-95 transition-all"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                    <span>{t('admin.markDismissed', 'Отклонить')}</span>
                  </button>
                )}
                {report.status !== 'pending' && (
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(report.id, 'pending')}
                    disabled={updateMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container text-label-sm font-medium transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                    <span>{t('admin.markPending', 'В ожидающие')}</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
