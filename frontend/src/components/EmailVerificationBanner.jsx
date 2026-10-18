import { useState } from 'react'
import { useProfileQuery, useResendVerificationMutation } from '../api/queries'
import { useLanguage } from '../context/LanguageContext'
import { useNotifications } from './Notifications'
import { haptics } from '../utils/haptics'

export default function EmailVerificationBanner() {
  const profileQuery = useProfileQuery()
  const resendMutation = useResendVerificationMutation()
  const { language } = useLanguage()
  const { notify } = useNotifications()
  const [dismissed, setDismissed] = useState(false)

  const user = profileQuery.data?.user
  if (!user || user.is_verified || dismissed) {
    return null
  }

  const isRu = language === 'ru'

  const handleResend = () => {
    haptics.impact()
    resendMutation.mutate(undefined, {
      onSuccess: () => {
        haptics.success()
        notify(isRu ? 'Письмо с подтверждением отправлено!' : 'Verification email sent!')
      },
      onError: (err) => {
        haptics.error()
        notify(err?.message || (isRu ? 'Ошибка при отправке' : 'Failed to send email'), 'error')
      },
    })
  }

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 text-on-surface px-4 py-2.5 flex items-center justify-between gap-3 text-label-sm font-medium z-30">
      <div className="flex items-center gap-2 min-w-0">
        <span className="material-symbols-outlined text-amber-500 text-[18px] shrink-0">
          mark_email_unread
        </span>
        <span className="truncate">
          {isRu
            ? 'Пожалуйста, подтвердите ваш email'
            : 'Please verify your email address'}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleResend}
          disabled={resendMutation.isPending}
          className="text-primary font-bold hover:underline disabled:opacity-50"
        >
          {resendMutation.isPending
            ? isRu ? 'Отправка...' : 'Sending...'
            : isRu ? 'Отправить повторно' : 'Resend'}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-on-surface-variant hover:text-on-surface p-1"
          aria-label={isRu ? 'Закрыть' : 'Dismiss'}
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>
    </div>
  )
}
