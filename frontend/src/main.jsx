import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'
import { NotificationsProvider, notifyError } from './components/Notifications.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'

import { initSentry, captureSentryException } from './sentry.js'
import { LanguageProvider } from './context/LanguageContext.jsx'

initSentry()

// Automatically reload the page when a dynamically imported chunk fails to load due to a new deployment
window.addEventListener('vite:preloadError', () => {
  const lastReload = sessionStorage.getItem('last_chunk_reload')
  const now = Date.now()
  if (!lastReload || now - Number(lastReload) > 10000) {
    sessionStorage.setItem('last_chunk_reload', String(now))
    window.location.reload()
  }
})

registerSW({ immediate: true })

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (error?.status === 404 && query?.meta?.ignore404) return
      if (error?.status === 401) return
      
      // Capture 5xx or unexpected network/runtime exceptions in Sentry
      if (!error?.status || error.status >= 500) {
        captureSentryException(error, { extra: { queryKey: query?.queryKey } })
      }

      notifyError(error)
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      if (error?.status === 401) return

      if (!error?.status || error.status >= 500) {
        captureSentryException(error)
      }

      notifyError(error)
    },
  }),
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <NotificationsProvider>
            <App />
          </NotificationsProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
