import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useVerifyEmailMutation } from '../api/queries'
import { useLanguage } from '../context/LanguageContext'
import { useNotifications } from '../components/Notifications'
import AppLogo from '../components/AppLogo'
import { haptics } from '../utils/haptics'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const navigate = useNavigate()
  const { language } = useLanguage()
  const { notify } = useNotifications()
  const verifyMutation = useVerifyEmailMutation()
  const [status, setStatus] = useState('verifying') // 'verifying', 'success', 'error'
  const [errorMessage, setErrorMessage] = useState('')

  const isRu = language === 'ru'

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setErrorMessage(isRu ? 'Токен подтверждения не найден в ссылке' : 'Verification token is missing')
      return
    }

    verifyMutation.mutate(token, {
      onSuccess: () => {
        haptics.success()
        setStatus('success')
        notify(isRu ? 'Email успешно подтвержден!' : 'Email verified successfully!')
      },
      onError: (err) => {
        haptics.error()
        setStatus('error')
        setErrorMessage(err?.message || (isRu ? 'Ссылка недействительна или устарела' : 'Invalid or expired link'))
      },
    })
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background text-on-surface">
      <div className="w-full max-w-sm rounded-2xl bg-surface-container-lowest border border-outline-variant/30 p-6 shadow-floating text-center space-y-5">
        <div className="flex justify-center">
          <AppLogo className="h-12 w-12" />
        </div>

        {status === 'verifying' && (
          <div className="space-y-3 py-4">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <h1 className="text-title-lg font-bold">
              {isRu ? 'Подтверждаем email...' : 'Verifying email...'}
            </h1>
            <p className="text-body-sm text-on-surface-variant">
              {isRu ? 'Пожалуйста, подождите пару секунд' : 'Please wait a moment'}
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4 py-2">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-success-container text-success">
              <span className="material-symbols-outlined text-[32px]">check_circle</span>
            </div>
            <h1 className="text-title-lg font-bold">
              {isRu ? 'Email подтвержден!' : 'Email Verified!'}
            </h1>
            <p className="text-body-sm text-on-surface-variant">
              {isRu
                ? 'Ваш аккаунт полностью верифицирован. Теперь вы можете использовать все возможности приложения.'
                : 'Your account is now fully verified. You can now use all features.'}
            </p>
            <button
              type="button"
              onClick={() => navigate('/home')}
              className="w-full py-3 rounded-xl bg-primary text-on-primary font-bold shadow-subtle hover:opacity-90 active:scale-98 transition-transform"
            >
              {isRu ? 'Перейти в дневник' : 'Go to Journal'}
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4 py-2">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-error-container text-error">
              <span className="material-symbols-outlined text-[32px]">error</span>
            </div>
            <h1 className="text-title-lg font-bold">
              {isRu ? 'Ошибка подтверждения' : 'Verification Failed'}
            </h1>
            <p className="text-body-sm text-error">
              {errorMessage}
            </p>
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => navigate('/home')}
                className="w-full py-3 rounded-xl bg-surface-container-high text-on-surface font-semibold hover:bg-surface-container-highest"
              >
                {isRu ? 'На главную' : 'Go Home'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
