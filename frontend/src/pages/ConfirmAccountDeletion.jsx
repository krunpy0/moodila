import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { confirmAccountDeletion, logout } from '../api/auth'
import { useQueryClient } from '@tanstack/react-query'

export default function ConfirmAccountDeletion() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState('')

  const handleConfirm = async () => {
    if (!token) {
      setError('Account deletion token is missing from the link.')
      return
    }

    setIsPending(true)
    setError('')

    try {
      await confirmAccountDeletion(token)
      await logout()
      queryClient.clear()
      navigate('/login', {
        replace: true,
        state: { message: 'Your Moodila account has been successfully deleted.' },
      })
    } catch (err) {
      setError(err.message || 'Failed to confirm account deletion. The token may be invalid or expired.')
      setIsPending(false)
    }
  }

  return (
    <main className="min-h-screen bg-background text-on-background px-container-margin py-xl flex items-center justify-center">
      <section className="w-full max-w-md" aria-labelledby="confirm-delete-title">
        <div className="mb-xl text-center">
          <div className="mx-auto mb-md flex h-16 w-16 items-center justify-center rounded-full bg-error-container text-error text-[32px]">
            <span aria-hidden="true">⚠️</span>
          </div>
          <h1 id="confirm-delete-title" className="text-headline-xl font-headline-xl text-on-surface">
            Confirm Account Deletion
          </h1>
          <p className="mt-xs text-body-sm font-body-sm text-on-surface-variant">
            Factor 2 of 2 — Permanent action
          </p>
        </div>

        <div className="rounded-[24px] bg-surface-container-lowest p-lg cloud-shadow space-y-md">
          {!token ? (
            <div className="flex flex-col gap-md text-center">
              <p className="rounded-xl bg-error-container/60 p-sm text-body-sm font-medium text-on-error-container" role="alert">
                Account deletion link is invalid or missing a valid token.
              </p>
              <Link
                to="/login"
                className="mt-xs flex h-12 items-center justify-center rounded-full bg-primary-container text-label-lg font-semibold text-on-primary-container"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <div className="space-y-md">
              <div className="rounded-xl bg-error-container/40 p-sm text-body-sm text-on-error-container border border-error/10">
                <p className="font-semibold">Are you absolutely sure?</p>
                <p className="mt-xs text-label-sm opacity-90">
                  Deleting your account will anonymize your profile, hide all your journal entries, and remove your friend connections in Moodila.
                </p>
              </div>

              {error && (
                <p role="alert" className="rounded-xl bg-error-container p-sm text-body-sm font-medium text-on-error-container">
                  {error}
                </p>
              )}

              <div className="flex flex-col gap-sm pt-xs">
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isPending}
                  className="h-12 w-full rounded-full bg-error text-label-lg font-semibold text-on-error shadow-sm transition-opacity hover:opacity-95 disabled:opacity-50"
                >
                  {isPending ? 'Deleting account...' : 'Confirm Account Deletion'}
                </button>
                <Link
                  to="/"
                  className="flex h-12 items-center justify-center rounded-full bg-surface-container-highest text-label-lg font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high"
                >
                  Cancel and keep my account
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
