import { Link, useLocation } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'

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
      className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-40px)] max-w-md -translate-x-1/2 items-center justify-around rounded-full bg-surface/90 px-4 py-2 cloud-shadow backdrop-blur-xl lg:hidden"
    >
      {items.map(([to, icon, labelKey]) => {
        const active = to && pathname === to
        const label = t(labelKey)
        const classes = `flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
          icon === 'add'
            ? 'h-14 w-14 bg-on-background text-background shadow-lg'
            : active
              ? 'bg-primary-container text-on-primary-container'
              : 'text-on-surface-variant'
        }`

        return to ? (
          <Link key={labelKey} to={to} aria-label={label} title={label} className={classes}>
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
