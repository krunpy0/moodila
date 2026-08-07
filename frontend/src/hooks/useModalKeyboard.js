import { useEffect } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable]',
].join(',')

function getFocusableElements(container) {
  if (!container) return []
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0
  )
}

/**
 * Custom hook to manage modal keyboard shortcuts (Escape to close),
 * focus trapping, focus restoration, and background scroll locking.
 *
 * @param {Function} onClose - Callback when Escape is pressed or modal is dismissed
 * @param {boolean} isOpen - Whether the modal is currently visible
 * @param {React.RefObject} containerRef - Ref to the inner modal dialog element
 */
export function useModalKeyboard(onClose, isOpen = true, containerRef = null) {
  useEffect(() => {
    if (!isOpen) return

    const previousActiveElement = document.activeElement

    const timer = setTimeout(() => {
      if (containerRef?.current) {
        const focusables = getFocusableElements(containerRef.current)
        if (focusables.length > 0) {
          const autoFocusEl = focusables.find((el) => el.hasAttribute('autofocus'))
          if (autoFocusEl) {
            autoFocusEl.focus()
          } else {
            focusables[0].focus()
          }
        } else {
          containerRef.current.setAttribute('tabindex', '-1')
          containerRef.current.focus()
        }
      }
    }, 50)

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose?.()
        return
      }

      if (e.key === 'Tab' && containerRef?.current) {
        const focusables = getFocusableElements(containerRef.current)
        if (focusables.length === 0) {
          e.preventDefault()
          return
        }

        const firstElement = focusables[0]
        const lastElement = focusables[focusables.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === firstElement || !containerRef.current.contains(document.activeElement)) {
            e.preventDefault()
            lastElement.focus()
          }
        } else {
          if (document.activeElement === lastElement || !containerRef.current.contains(document.activeElement)) {
            e.preventDefault()
            firstElement.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      clearTimeout(timer)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = originalOverflow
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        previousActiveElement.focus()
      }
    }
  }, [isOpen, onClose, containerRef])
}

export default useModalKeyboard
