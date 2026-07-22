import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getHealth } from '../api/health'
import { clearToken } from '../api/client'

// Feature 0 skeleton screen: confirms the frontend can reach the backend.
export default function Home() {
  const [state, setState] = useState({ status: 'loading' })
  const navigate = useNavigate()

  useEffect(() => {
    getHealth()
      .then((h) => setState({ status: 'ok', ...h }))
      .catch((e) => setState({ status: 'error', error: String(e) }))
  }, [])

  const ok = state.status === 'ok'
  const pill =
    state.status === 'loading'
      ? 'bg-surface-container text-on-surface-variant'
      : ok
        ? 'bg-secondary-container text-on-secondary-container'
        : 'bg-error-container text-on-error-container'

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col items-center justify-center px-container-margin">
      <div
        className="w-full max-w-md bg-white rounded-[24px] p-lg cloud-shadow flex flex-col items-center gap-md text-center"
        role="status"
        aria-live="polite"
      >
        <div
          className="w-14 h-14 rounded-full bg-primary-container flex items-center justify-center text-[28px]"
          aria-hidden="true"
        >
          🌸
        </div>
        <h1 className="text-headline-xl font-headline-xl text-on-surface">MoodShare</h1>
        <p className="text-body-sm font-body-sm text-on-surface-variant">
          A calm place to keep track of your days.
        </p>

        <div className={`mt-sm flex items-center gap-xs px-md py-sm rounded-full text-label-lg font-label-lg ${pill}`}>
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            {state.status === 'loading' ? 'sync' : ok ? 'check_circle' : 'error'}
          </span>
          {state.status === 'loading' ? 'Checking backend...' : ok ? 'backend OK' : 'Backend unreachable'}
        </div>

        {ok && (
          <p className="text-label-sm font-label-sm text-on-surface-variant">
            db: {state.db} / {new Date(state.time).toLocaleTimeString()}
          </p>
        )}
        {state.status === 'error' && (
          <p className="text-label-sm font-label-sm text-error">{state.error}</p>
        )}

        <button
          type="button"
          onClick={() => {
            clearToken()
            navigate('/login', { replace: true })
          }}
          className="mt-sm h-11 px-lg rounded-lg bg-surface-container-low text-on-surface-variant text-label-lg font-label-lg"
        >
          Log out
        </button>
      </div>
    </div>
  )
}
