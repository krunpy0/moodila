import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useSessionQuery } from './api/queries'
import Home from './pages/Home'
import Auth from './pages/Auth'
import AddEntry from './pages/AddEntry'
import Calendar from './pages/Calendar'
import Friends from './pages/Friends'
import Feed from './pages/Feed'
import Profile from './pages/Profile'
import FriendProfile from './pages/FriendProfile'
import Admin from './pages/Admin'
import AnnouncementQueue from './components/AnnouncementQueue'
import PWAInstallPrompt from './components/PWAInstallPrompt'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Auth />} />
        <Route
          path="/"
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
    </BrowserRouter>
  )
}

function RequireAuth({ children }) {
  const { isLoading, isError } = useSessionQuery(true)
  if (isError) {
    return <Navigate to="/login" replace />
  }
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-on-surface-variant">
        Checking session...
      </div>
    )
  }
  return (
    <>
      <PWAInstallPrompt />
      <AnnouncementQueue />
      {children}
    </>
  )
}
