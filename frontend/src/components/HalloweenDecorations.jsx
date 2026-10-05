/* Hallmark · designed-as-app · design-system: DESIGN.md */
import { useTheme } from '../context/ThemeContext'
import { CobwebIcon, BatIcon } from './HalloweenIcons'

/**
 * Atmospheric Halloween decorations overlay.
 * Non-intrusive (pointer-events: none), lightweight, graceful fallback for prefers-reduced-motion.
 */
export default function HalloweenDecorations() {
  const { isHalloween } = useTheme()

  if (!isHalloween) return null

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-30 overflow-hidden select-none"
    >
      {/* Delicate corner spiderweb */}
      <div className="absolute top-0 right-0 w-24 h-24 sm:w-36 sm:h-36 text-outline/25 dark:text-primary/20 transition-opacity duration-normal">
        <CobwebIcon className="w-full h-full" />
      </div>

      {/* Floating silhouettes of bats in the distance */}
      <div className="absolute top-4 right-1/4 sm:right-1/3 opacity-30 dark:opacity-40 text-on-surface-variant dark:text-primary/70 animate-spooky-bat">
        <div className="animate-spooky-flutter">
          <BatIcon className="w-6 h-4 sm:w-8 sm:h-5" />
        </div>
      </div>
      <div className="absolute top-12 left-8 sm:left-16 opacity-20 dark:opacity-30 text-on-surface-variant dark:text-tertiary/70 animate-spooky-bat-reverse">
        <div className="animate-spooky-flutter">
          <BatIcon className="w-4 h-3 sm:w-6 sm:h-4" />
        </div>
      </div>

      {/* Subtle Jack-o'-Lantern floating embers */}
      <div
        className="absolute bottom-24 left-1/4 w-1.5 h-1.5 rounded-full bg-primary/40 dark:bg-primary/60 blur-[0.5px]"
        style={{
          animation: 'spookyEmberDrift 9s ease-in-out infinite',
          animationDelay: '1s',
        }}
      />
      <div
        className="absolute bottom-36 right-1/3 w-2 h-2 rounded-full bg-primary/30 dark:bg-primary/50 blur-[1px]"
        style={{
          animation: 'spookyEmberDrift 11s ease-in-out infinite',
          animationDelay: '4s',
        }}
      />
      <div
        className="absolute bottom-16 right-12 w-1.5 h-1.5 rounded-full bg-tertiary/30 dark:bg-tertiary/50 blur-[0.5px]"
        style={{
          animation: 'spookyEmberDrift 10s ease-in-out infinite',
          animationDelay: '7s',
        }}
      />
    </div>
  )
}
