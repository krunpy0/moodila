import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useSessionQuery } from '../api/queries'
import Landing from './Landing'

export default function RootRoute() {
  const { data, isLoading, isError } = useSessionQuery(true)
  const isStandalone =
    typeof window !== 'undefined' &&
    window.matchMedia('(display-mode: standalone)').matches
  const hasVisited =
    typeof window !== 'undefined' && Boolean(localStorage.getItem('ms_visited'))

  const isAuthenticated = Boolean(data && !isError)

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isStandalone && !hasVisited) {
      localStorage.setItem('ms_visited', '1')
    }
  }, [isLoading, isAuthenticated, isStandalone, hasVisited])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-on-surface-variant gap-md">
        <div className="w-16 h-16 rounded-full bg-primary-container flex items-center justify-center text-[30px] animate-pulse">
          <span>🌸</span>
        </div>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/home" replace />
  }

  if (isStandalone || hasVisited) {
    return <Navigate to="/login" replace />
  }

  return <Landing />
}
