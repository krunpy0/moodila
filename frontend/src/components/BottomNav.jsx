/* Hallmark · designed-as-app · design-system: DESIGN.md */
import { Link, useLocation } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { haptics } from '../utils/haptics'

const items = [
  ['/home', 'home', 'nav.home'],
  ['/calendar', 'calendar_today', 'nav.calendar'],
  ['/entries/new', 'add', 'nav.addEntry'],
  ['/feed', 'grid_view', 'nav.feed'],
  ['/profile', 'person', 'nav.profile'],
]

export default function BottomNav() {
  const { pathname } = useLocation()
  const { t } = useLanguage()

  return (
    <nav
      aria-label={t('nav.home')}
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] inset-x-4 mx-auto z-50 flex max-w-md items-center justify-around rounded-full bg-surface/90 border border-outline-variant/30 px-3 py-2 shadow-floating backdrop-blur-xl lg:hidden select-none touch-manipulation"
    >
      {items.map(([to, icon, labelKey]) => {
        const active = to && pathname === to
        const label = t(labelKey)
        const classes = `flex h-11 w-11 items-center justify-center rounded-full transition-all duration-fast active:scale-95 ${
          icon === 'add'
            ? 'h-12 w-12 bg-primary text-on-primary shadow-card'
            : active
              ? 'bg-primary-container text-on-primary-container font-semibold'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/40'
        }`

        return to ? (
          <Link
            key={labelKey}
            to={to}
            aria-label={label}
            title={label}
            className={classes}
            onClick={() => {
              if (icon === 'add') {
                haptics.impact()
              } else {
                haptics.selection()
              }
            }}
          >
            <span
              className="material-symbols-outlined"
              style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {icon}
            </span>
          </Link>
        ) : (
          <span
            key={labelKey}
            aria-label={label}
            title={label}
            className={`${classes} opacity-50`}
          >
            <span className="material-symbols-outlined">{icon}</span>
          </span>
        )
      })}
    </nav>
  )
}
