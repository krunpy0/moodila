import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { getSession } from './api/auth'
import { clearToken, getToken } from './api/client'
import Home from './pages/Home'
import Auth from './pages/Auth'

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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

function RequireAuth({ children }) {
  const [valid, setValid] = useState(null)

  useEffect(() => {
    if (!getToken()) {
      setValid(false)
      return
    }
    getSession()
      .then(() => setValid(true))
      .catch(() => {
        clearToken()
        setValid(false)
      })
  }, [])

  if (valid === false) return <Navigate to="/login" replace />
  if (valid === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-on-surface-variant">
        Checking session...
      </div>
    )
  }
  return children
}
