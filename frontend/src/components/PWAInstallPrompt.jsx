import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { syncOfflineEntriesWithBackend } from '../api/entries'
import { notifySuccess, notifyInfo } from './Notifications'

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [showIOSBanner, setShowIOSBanner] = useState(false)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [syncStatus, setSyncStatus] = useState(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    // Check iOS Safari device state
    const isIOS = /ipad|iphone|ipod/i.test(navigator.userAgent) && !window.MSStream
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone
    const dismissedIOS = sessionStorage.getItem('pwa_ios_dismissed')

    if (isIOS && !isStandalone && !dismissedIOS) {
      setShowIOSBanner(true)
    }

    // Listen for beforeinstallprompt event (Android / Chrome / Edge / Desktop)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      if (!sessionStorage.getItem('pwa_install_dismissed')) {
        setShowInstallBanner(true)
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Listen for appinstalled
    const handleAppInstalled = () => {
      setDeferredPrompt(null)
      setShowInstallBanner(false)
      notifySuccess('MoodShare installed successfully!')
    }

    window.addEventListener('appinstalled', handleAppInstalled)

    // Network status listeners
    const handleOffline = () => {
      setIsOffline(true)
      notifyInfo('You are offline. New entries are saved locally.')
    }

    const handleOnline = async () => {
      setIsOffline(false)
      notifyInfo('Connection restored. Syncing pending entries...')

      try {
        const result = await syncOfflineEntriesWithBackend()
        if (result.synced > 0) {
          setSyncStatus(`Synced entries: ${result.synced}`)
          notifySuccess(`Successfully synced ${result.synced} offline entry(ies)!`)
          queryClient.invalidateQueries()
          setTimeout(() => setSyncStatus(null), 5000)
        }
      } catch (err) {
        console.error('Offline sync error:', err)
      }
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    // Initial sync check on mount
    if (navigator.onLine) {
      syncOfflineEntriesWithBackend().then((result) => {
        if (result?.synced > 0) {
          notifySuccess(`Synced ${result.synced} offline entry(ies)!`)
          queryClient.invalidateQueries()
        }
      })
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [queryClient])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowInstallBanner(false)
    }
    setDeferredPrompt(null)
  }

  const dismissInstallBanner = () => {
    setShowInstallBanner(false)
    sessionStorage.setItem('pwa_install_dismissed', 'true')
  }

  const dismissIOSBanner = () => {
    setShowIOSBanner(false)
    sessionStorage.setItem('pwa_ios_dismissed', 'true')
  }

  return (
    <>
      {/* Offline Status Badge */}
      {isOffline && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-amber-500/95 backdrop-blur-md text-amber-950 font-medium text-xs rounded-full shadow-lg flex items-center gap-2 border border-amber-400/50 transition-all animate-pulse">
          <span className="material-symbols-outlined text-sm">wifi_off</span>
          <span>Offline mode: entries saved on your device</span>
        </div>
      )}

      {/* Sync Success Banner */}
      {syncStatus && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-emerald-600/95 backdrop-blur-md text-white font-medium text-xs rounded-full shadow-lg flex items-center gap-2 border border-emerald-400/50 transition-all">
          <span className="material-symbols-outlined text-sm">cloud_done</span>
          <span>{syncStatus}</span>
        </div>
      )}

      {/* Android / Chrome Add to Home Screen Banner */}
      {showInstallBanner && (
        <div className="fixed bottom-20 left-4 right-4 max-w-md mx-auto z-40 bg-slate-900/95 text-white p-4 rounded-2xl shadow-2xl border border-slate-700/60 backdrop-blur-lg flex items-center justify-between gap-3 animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-md">
              <span className="material-symbols-outlined text-white text-xl">install_mobile</span>
            </div>
            <div>
              <h4 className="font-semibold text-sm leading-tight text-slate-100">Install MoodShare</h4>
              <p className="text-xs text-slate-400 mt-0.5">Add to home screen for quick access</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={dismissInstallBanner}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
              aria-label="Close"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
            <button
              onClick={handleInstallClick}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-xl shadow-md transition active:scale-95 whitespace-nowrap"
            >
              Install
            </button>
          </div>
        </div>
      )}

      {/* iOS Safari Installation Guide Banner */}
      {showIOSBanner && (
        <div className="fixed bottom-20 left-4 right-4 max-w-md mx-auto z-40 bg-slate-900/95 text-white p-4 rounded-2xl shadow-2xl border border-slate-700/60 backdrop-blur-lg flex items-center justify-between gap-3 animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-md">
              <span className="material-symbols-outlined text-white text-xl">ios_share</span>
            </div>
            <div>
              <h4 className="font-semibold text-sm leading-tight text-slate-100">Install on iPhone</h4>
              <p className="text-xs text-slate-300 mt-0.5">
                Tap <span className="font-bold">Share</span> <span className="material-symbols-outlined text-[14px] align-middle">ios_share</span> then select <span className="font-bold">Add to Home Screen</span>.
              </p>
            </div>
          </div>
          <button
            onClick={dismissIOSBanner}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      )}
    </>
  )
}
