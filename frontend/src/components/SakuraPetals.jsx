/* Hallmark · designed-as-app · design-system: DESIGN.md */
import { useTheme } from '../context/ThemeContext'

/**
 * Single Sakura (Cherry Blossom) Petal SVG.
 * Authentic notched petal shape with organic curve.
 */
function Petal({ className, style }) {
  return (
    <svg
      viewBox="0 0 24 32"
      aria-hidden="true"
      className={className}
      style={style}
      fill="currentColor"
    >
      <path d="M12 4.5 C10.8 2.2 8.2 1 5.5 3 C1.8 5.8 1 12.5 3.5 19 C6.5 26.5 12 30 12 30 C12 30 17.5 26.5 20.5 19 C23 12.5 22.2 5.8 18.5 3 C15.8 1 13.2 2.2 12 4.5 Z" />
    </svg>
  )
}

/**
 * Atmospheric Sakura decor across all app screens.
 * - Shown only for Sakura theme (light & dark).
 * - Distributed elegantly across the background canvas:
 *   header top-right cluster (near bell), left/right edges, and bottom.
 * - Layered underneath the content (z-0, pointer-events-none).
 * - Static petals, different sizes & rotations, colored with accent-soft (primary-container).
 * - No animations.
 */
export default function SakuraPetals() {
  const { theme } = useTheme()
  const isSakura = theme === 'sakura-light' || theme === 'sakura-dark'

  if (!isSakura) return null

  return (
    <div
      aria-hidden="true"
      className="sakura-petals pointer-events-none select-none fixed inset-0 z-0 overflow-hidden text-primary-container"
    >
      <div className="relative mx-auto h-full w-full max-w-md lg:max-w-6xl">
        {/* --- Top Right Header Cluster (near bell icon) --- */}
        <Petal className="absolute top-3 right-4 w-4 h-5.5 rotate-[42deg] opacity-90" />
        <Petal className="absolute top-5 right-16 w-3 h-4 -rotate-[14deg] opacity-80" />
        <Petal className="absolute top-10 right-2 w-4.5 h-6 rotate-[24deg] opacity-95" />
        <Petal className="absolute top-20 right-7 w-3.5 h-5 -rotate-[38deg] opacity-85" />
        <Petal className="absolute top-32 right-3 w-2.5 h-3.5 rotate-[60deg] opacity-75" />

        {/* --- Upper Left & Mid Left Margin --- */}
        <Petal className="absolute top-16 left-3 sm:left-6 w-3 h-4.5 rotate-[55deg] opacity-70" />
        <Petal className="absolute top-48 left-2 sm:left-5 w-4 h-5.5 -rotate-[25deg] opacity-80" />
        <Petal className="absolute top-[45%] left-4 sm:left-8 w-2.5 h-3.5 rotate-[15deg] opacity-65" />

        {/* --- Mid Right Margin --- */}
        <Petal className="absolute top-[52%] right-4 sm:right-7 w-3.5 h-5 rotate-[32deg] opacity-80" />
        <Petal className="absolute top-[68%] right-2 sm:right-6 w-3 h-4 -rotate-[20deg] opacity-75" />

        {/* --- Lower Area (above floating bottom navigation) --- */}
        <Petal className="absolute bottom-32 left-4 sm:left-8 w-4 h-5.5 -rotate-[40deg] opacity-75" />
        <Petal className="absolute bottom-24 right-5 sm:right-10 w-3 h-4.5 rotate-[20deg] opacity-80" />
        <Petal className="absolute bottom-44 right-14 w-2.5 h-3.5 -rotate-[15deg] opacity-60" />
      </div>
    </div>
  )
}
