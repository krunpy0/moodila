import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useAdminReportsQuery,
  useUpdateAdminReportStatusMutation,
  useDeleteAdminReportedContentMutation,
} from '../api/queries'
import { useLanguage } from '../context/LanguageContext'
import { useNotifications } from './Notifications'
import MoodIcon from './MoodIcon'
import VoiceNotePlayer from './VoiceNotePlayer'
import ImageWithSkeleton from './ImageWithSkeleton'
import { getMoodInfo, getLocalizedTag } from '../utils/moods'

export default function AdminReports() {
  const { t } = useLanguage()
  const { notify } = useNotifications()
  const [statusFilter, setStatusFilter] = useState('all')

  const { data, isLoading, isError, error } = useAdminReportsQuery(
    statusFilter === 'all' ? '' : statusFilter
  )
  const updateMutation = useUpdateAdminReportStatusMutation()
  const deleteContentMutation = useDeleteAdminReportedContentMutation()
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

  const handleDeleteContent = (id, entityType) => {
    const confirmText =
      entityType === 'comment'
        ? t('admin.confirmDeleteComment', 'Удалить этот комментарий и пометить жалобу рассмотренной?')
        : t('admin.confirmDeleteEntry', 'Удалить эту публикацию и пометить жалобу рассмотренной?')

    if (!window.confirm(confirmText)) {
      return
    }

    deleteContentMutation.mutate(id, {
      onSuccess: () => {
        notify(t('admin.contentDeletedSuccess', 'Публикация удалена, жалоба рассмотрена'), 'success')
      },
      onError: (err) => {
        notify(err.message, 'error')
      },
    })
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
        <div className="space-y-6">
          {reports.map((report) => {
            const moodInfo = report.entry_mood ? getMoodInfo(report.entry_mood, t) : null

            return (
              <div
                key={report.id}
                className="rounded-[24px] bg-surface-container-lowest p-5 sm:p-6 shadow-card border border-outline-variant/20 space-y-5"
              >
                {/* Header: Status, Entity type, Reason, Timestamp */}
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

                {/* Reporter & Reported User info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-body-sm">
                  <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/10">
                    <span className="text-label-xs font-semibold uppercase text-on-surface-variant block mb-1">
                      {t('admin.reporter', 'Кто пожаловался')}
                    </span>
                    <Link
                      to={`/profile/${report.reporter_id}`}
                      className="font-semibold text-primary hover:underline block truncate"
                    >
                      {report.reporter_display_name || report.reporter_username}
                    </Link>
                    <p className="text-label-sm text-on-surface-variant truncate">
                      @{report.reporter_username}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/10">
                    <span className="text-label-xs font-semibold uppercase text-on-surface-variant block mb-1">
                      {t('admin.reportedUser', 'На кого жалоба')}
                    </span>
                    <Link
                      to={`/profile/${report.reported_user_id}`}
                      className="font-semibold text-primary hover:underline block truncate"
                    >
                      {report.reported_display_name || report.reported_username}
                    </Link>
                    <p className="text-label-sm text-on-surface-variant truncate">
                      @{report.reported_username}
                    </p>
                  </div>
                </div>

                {/* Details provided by reporter */}
                {report.details && (
                  <div className="p-3.5 rounded-2xl bg-surface-container/60 border border-outline-variant/10">
                    <span className="text-label-xs font-semibold uppercase text-on-surface-variant block mb-1">
                      {t('admin.reportDetails', 'Комментарий заявителя')}
                    </span>
                    <p className="text-body-sm text-on-surface whitespace-pre-wrap">
                      {report.details}
                    </p>
                  </div>
                )}

                {/* REPORTED CONTENT PREVIEW */}
                <div className="rounded-2xl border-2 border-outline-variant/30 bg-surface-container-low/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-label-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">visibility</span>
                      {t('admin.reportedContentHeader', 'Проверяемый контент')}
                    </span>
                    {report.entity_type === 'entry' && report.entity_id && !report.is_content_deleted && (
                      <Link
                        to={`/feed?entry=${report.entity_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-label-sm font-semibold text-primary hover:underline"
                      >
                        <span>{t('admin.openInFeed', 'Открыть в ленте')}</span>
                        <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                      </Link>
                    )}
                  </div>

                  {report.is_content_deleted ? (
                    <div className="flex items-center gap-2 py-3 px-4 rounded-xl bg-surface-container text-on-surface-variant text-body-sm">
                      <span className="material-symbols-outlined text-[20px] text-error">delete_forever</span>
                      <span>{t('admin.contentAlreadyDeleted', 'Публикация удалена или недоступна.')}</span>
                    </div>
                  ) : report.entity_type === 'entry' ? (
                    /* Entry Preview Card */
                    <div className="rounded-xl bg-surface-container-lowest p-4 border border-outline-variant/20 shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {moodInfo && (
                            <span
                              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-label-sm font-bold ${moodInfo.bg} ${moodInfo.onContainer || 'text-on-surface'}`}
                            >
                              <MoodIcon mood={report.entry_mood} className="text-[18px]" />
                              <span>{moodInfo.label}</span>
                            </span>
                          )}
                          {report.entry_date && (
                            <span className="text-label-sm text-on-surface-variant font-medium">
                              {report.entry_date}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Entry Tags */}
                      {report.entry_tags && report.entry_tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {report.entry_tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-surface-container px-2.5 py-0.5 text-label-xs text-on-surface-variant"
                            >
                              {getLocalizedTag(tag, t)}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Entry Text */}
                      {report.entry_text ? (
                        <p className="text-body-md text-on-surface whitespace-pre-wrap leading-relaxed">
                          {report.entry_text}
                        </p>
                      ) : (
                        <p className="text-label-sm italic text-on-surface-variant">
                          {t('admin.noTextInEntry', 'Запись без текста')}
                        </p>
                      )}

                      {/* Entry Photo */}
                      {report.entry_photo_url && (
                        <div className="overflow-hidden rounded-xl bg-surface-container-high max-w-md">
                          <ImageWithSkeleton
                            src={report.entry_photo_url}
                            alt="Reported content"
                            className="w-full max-h-80 object-cover"
                          />
                        </div>
                      )}

                      {/* Entry Audio */}
                      {report.entry_audio_url && (
                        <div className="max-w-md pt-1">
                          <VoiceNotePlayer
                            audioUrl={report.entry_audio_url}
                            duration={report.entry_audio_duration}
                          />
                        </div>
                      )}
                    </div>
                  ) : report.entity_type === 'comment' ? (
                    /* Comment Preview Card */
                    <div className="rounded-xl bg-surface-container-lowest p-4 border border-outline-variant/20 shadow-xs space-y-2">
                      <p className="text-body-md text-on-surface whitespace-pre-wrap">
                        {report.comment_text || report.content_snippet}
                      </p>
                      {report.comment_entry_id && (
                        <Link
                          to={`/feed?entry=${report.comment_entry_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-label-sm font-semibold text-primary hover:underline pt-1"
                        >
                          <span>{t('admin.openPostWithComment', 'Открыть пост с этим комментарием')}</span>
                          <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                        </Link>
                      )}
                    </div>
                  ) : (
                    /* User Profile Preview Card */
                    <div className="rounded-xl bg-surface-container-lowest p-4 border border-outline-variant/20 shadow-xs flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-on-surface">
                          {report.reported_display_name || report.reported_username}
                        </p>
                        <p className="text-label-sm text-on-surface-variant">
                          @{report.reported_username}
                        </p>
                      </div>
                      <Link
                        to={`/profile/${report.reported_user_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-label-sm font-semibold text-primary hover:underline"
                      >
                        <span>{t('admin.viewUserProfile', 'Открыть профиль')}</span>
                        <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                      </Link>
                    </div>
                  )}
                </div>

                {/* Admin Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-outline-variant/10">
                  <div>
                    {!report.is_content_deleted &&
                      (report.entity_type === 'entry' || report.entity_type === 'comment') && (
                        <button
                          type="button"
                          onClick={() => handleDeleteContent(report.id, report.entity_type)}
                          disabled={deleteContentMutation.isPending}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-error/10 text-error hover:bg-error hover:text-on-error text-label-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                          <span>
                            {report.entity_type === 'comment'
                              ? t('admin.deleteCommentAction', 'Удалить комментарий')
                              : t('admin.deletePostAction', 'Удалить публикацию')}
                          </span>
                        </button>
                      )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {report.status !== 'reviewed' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(report.id, 'reviewed')}
                        disabled={updateMutation.isPending}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-success text-on-success text-label-sm font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
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
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-container text-on-surface text-label-sm font-semibold hover:bg-surface-container-high active:scale-95 transition-all disabled:opacity-50"
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
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container text-label-sm font-medium transition-colors disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                        <span>{t('admin.markPending', 'В ожидающие')}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
