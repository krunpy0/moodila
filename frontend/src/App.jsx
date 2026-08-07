import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useSessionQuery } from './api/queries'
import AnnouncementQueue from './components/AnnouncementQueue'
import PWAInstallPrompt from './components/PWAInstallPrompt'
import ErrorBoundary from './components/ErrorBoundary'
import SplashScreen from './components/SplashScreen'

const Home = lazy(() => import('./pages/Home'))
const Auth = lazy(() => import('./pages/Auth'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const ConfirmAccountDeletion = lazy(() => import('./pages/ConfirmAccountDeletion'))
const AddEntry = lazy(() => import('./pages/AddEntry'))
const Calendar = lazy(() => import('./pages/Calendar'))
const Stats = lazy(() => import('./pages/Stats'))
const Friends = lazy(() => import('./pages/Friends'))
const Feed = lazy(() => import('./pages/Feed'))
const Profile = lazy(() => import('./pages/Profile'))
const FriendProfile = lazy(() => import('./pages/FriendProfile'))
const Admin = lazy(() => import('./pages/Admin'))
const Landing = lazy(() => import('./pages/Landing'))
const RootRoute = lazy(() => import('./pages/RootRoute'))

function PageFallback() {
  return <SplashScreen />
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/landing" element={<Landing />} />
            <Route path="/login" element={<Auth />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/account/confirm-delete" element={<ConfirmAccountDeletion />} />
            <Route path="/" element={<RootRoute />} />
            <Route
              path="/home"
              element={
                <RequireAuth>
                  <Home />
                </RequireAuth>
              }
            />
            <Route
              path="/entries/new"
              element={
                <RequireAuth>
                  <AddEntry />
                </RequireAuth>
              }
            />
            <Route
              path="/calendar"
              element={
                <RequireAuth>
                  <Calendar />
                </RequireAuth>
              }
            />
            <Route
              path="/stats"
              element={
                <RequireAuth>
                  <Stats />
                </RequireAuth>
              }
            />
            <Route
              path="/friends"
              element={
                <RequireAuth>
                  <Friends />
                </RequireAuth>
              }
            />
            <Route
              path="/feed"
              element={
                <RequireAuth>
                  <Feed />
                </RequireAuth>
              }
            />
            <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
            <Route path="/profile/:id" element={<RequireAuth><FriendProfile /></RequireAuth>} />
            <Route path="/admin" element={<RequireAuth><Admin /></RequireAuth>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

function RequireAuth({ children }) {
  const { isLoading, isError } = useSessionQuery(true)
  if (isError) {
    return <Navigate to="/login" replace />
  }
  if (isLoading) {
    return <SplashScreen />
  }
  return (
    <>
      <PWAInstallPrompt />
      <AnnouncementQueue />
      {children}
    </>
  )
}
