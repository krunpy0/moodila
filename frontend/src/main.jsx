import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'
import { NotificationsProvider, notifyError } from './components/Notifications.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'

registerSW({ immediate: true })

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (error?.status === 404 && query?.meta?.ignore404) return
      if (error?.status === 401) return
      notifyError(error)
    },
  }),
  mutationCache: new MutationCache({ onError: notifyError }),
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <NotificationsProvider>
          <App />
        </NotificationsProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
