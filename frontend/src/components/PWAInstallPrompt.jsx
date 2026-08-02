import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { syncOfflineEntriesWithBackend } from '../api/entries'
import { notifySuccess, notifyInfo } from './Notifications'
import { useLanguage } from '../context/LanguageContext'

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [showIOSBanner, setShowIOSBanner] = useState(false)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [syncStatus, setSyncStatus] = useState(null)
  const queryClient = useQueryClient()
  const { t } = useLanguage()

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
      notifySuccess('Moodila installed successfully!')
    }

    window.addEventListener('appinstalled', handleAppInstalled)

    // Network status listeners
    const handleOffline = () => {
      setIsOffline(true)
      notifyInfo('Offline mode')
    }

    const handleOnline = async () => {
      setIsOffline(false)

      try {
        const result = await syncOfflineEntriesWithBackend()
        if (result.synced > 0) {
          setSyncStatus(`Synced entries: ${result.synced}`)
          notifySuccess(`Synced ${result.synced} offline entry(ies)!`)
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
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-tertiary-container/95 text-on-tertiary-container text-xs font-medium rounded-full cloud-shadow flex items-center gap-2 border border-tertiary/20 backdrop-blur-md transition-all animate-pulse">
          <span className="material-symbols-outlined text-base">wifi_off</span>
          <span>Offline mode</span>
        </div>
      )}

      {/* Sync Success Banner */}
      {syncStatus && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-secondary-container/95 text-on-secondary-container text-xs font-medium rounded-full cloud-shadow flex items-center gap-2 border border-secondary/20 backdrop-blur-md transition-all">
          <span className="material-symbols-outlined text-base">cloud_done</span>
          <span>{syncStatus}</span>
        </div>
      )}

      {/* Android / Chrome Add to Home Screen Banner */}
      {showInstallBanner && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-[calc(100%-40px)] max-w-md z-40 bg-surface-container-lowest/95 text-on-surface p-4 rounded-3xl cloud-shadow border border-outline-variant/30 backdrop-blur-xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">install_mobile</span>
            </div>
            <div className="min-w-0">
              <h4 className="font-semibold text-sm leading-tight text-on-surface truncate">{t('pwa.installTitle')}</h4>
              <p className="text-xs text-on-surface-variant mt-0.5 truncate">{t('pwa.installDescription')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={dismissInstallBanner}
              className="flex h-9 w-9 items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-full transition"
              aria-label={t('common.close')}
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
            <button
              onClick={handleInstallClick}
              className="px-4 py-2 bg-primary text-on-primary hover:opacity-90 font-semibold text-xs rounded-full shadow-sm transition active:scale-95 whitespace-nowrap"
            >
              {t('pwa.installBtn')}
            </button>
          </div>
        </div>
      )}

      {/* iOS Safari Installation Guide Banner */}
      {showIOSBanner && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-[calc(100%-40px)] max-w-md z-40 bg-surface-container-lowest/95 text-on-surface p-4 rounded-3xl cloud-shadow border border-outline-variant/30 backdrop-blur-xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">ios_share</span>
            </div>
            <div className="min-w-0">
              <h4 className="font-semibold text-sm leading-tight text-on-surface truncate">{t('pwa.installTitle')}</h4>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {t('pwa.installDescription')}
              </p>
            </div>
          </div>
          <button
            onClick={dismissIOSBanner}
            className="flex h-9 w-9 shrink-0 items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-full transition"
            aria-label={t('common.close')}
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      )}
    </>
  )
}
