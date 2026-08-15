import * as Sentry from '@sentry/react'

/**
 * Initialize Sentry error monitoring and performance tracing.
 * Gracefully ignores initialization if VITE_SENTRY_DSN is not provided.
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim()
  if (!dsn) {
    if (import.meta.env.DEV) {
      console.info('[Sentry] VITE_SENTRY_DSN not set. Monitoring is disabled.')
    }
    return
  }

  const environment = import.meta.env.MODE || (import.meta.env.PROD ? 'production' : 'development')
  const release = import.meta.env.VITE_SENTRY_RELEASE || 'moodila-frontend@1.0.0'

  // Quota protection: default 10% in production, 0% in development
  const tracesSampleRate = import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE !== undefined
    ? Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE)
    : (import.meta.env.PROD ? 0.1 : 0.0)

  Sentry.init({
    dsn,
    environment,
    release,
    tracesSampleRate,
    // Replay quota protection: 0% session replay, max 5% sample on fatal errors only
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: import.meta.env.PROD ? 0.05 : 0.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    ignoreErrors: [
      // Browser layout & benign noise
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      // Network drops / offline / extensions
      'NetworkError when attempting to fetch resource',
      'Failed to fetch',
      'Load failed',
      'Importing a module script failed',
      'AbortError',
      'canceled',
      'Non-Error promise rejection captured',
      'Extension context invalidated',
    ],
    beforeSend(event, hint) {
      // 1. Drop events when client is offline
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return null
      }

      const error = hint?.originalException

      // 2. Drop aborted network requests (user navigated away or timeout canceled)
      if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
        return null
      }

      // 3. Drop expected client / HTTP 4xx errors (401, 403, 404, 429, etc.)
      if (error?.status && typeof error.status === 'number' && error.status < 500) {
        return null
      }

      // 4. Drop noise from browser extensions
      const frames = event.exception?.values?.[0]?.stacktrace?.frames || []
      const isExtensionError = frames.some(
        (frame) =>
          frame.filename?.startsWith('chrome-extension://') ||
          frame.filename?.startsWith('moz-extension://') ||
          frame.filename?.startsWith('safari-extension://') ||
          frame.filename?.startsWith('webkit-masked-url://'),
      )
      if (isExtensionError) {
        return null
      }

      return event
    },
  })
}

/**
 * Capture an error to Sentry with safety checks against 4xx/noise.
 */
export function captureSentryException(error, context = {}) {
  if (!error) return

  // Do not report expected business / client errors (4xx)
  if (error?.status && typeof error.status === 'number' && error.status < 500) {
    return
  }

  // Do not report offline failures
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return
  }

  Sentry.captureException(error, context)
}

/**
 * Sync active user data with Sentry scope.
 */
export function setSentryUser(user) {
  if (!user) {
    Sentry.setUser(null)
    return
  }

  Sentry.setUser({
    id: String(user.id || user.user_id || ''),
    username: user.username || undefined,
  })
}

/**
 * Clear user context on logout.
 */
export function clearSentryUser() {
  Sentry.setUser(null)
}

export default Sentry
