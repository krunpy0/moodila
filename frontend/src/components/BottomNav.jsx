import { Link, useLocation } from 'react-router-dom'

const items = [
  ['/', 'home', 'Home'],
  ['/calendar', 'calendar_today', 'Calendar'],
  ['/entries/new', 'add', 'Add entry'],
  [null, 'grid_view', 'Feed'],
  ['/friends', 'person', 'Friends'],
]

export default function BottomNav() {
  const { pathname } = useLocation()

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-40px)] max-w-md -translate-x-1/2 items-center justify-around rounded-full bg-surface/90 px-4 py-2 cloud-shadow backdrop-blur-xl"
    >
      {items.map(([to, icon, label]) => {
        const active = to && pathname === to
        const classes = `flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
          icon === 'add'
            ? 'h-14 w-14 bg-on-background text-background shadow-lg'
            : active
              ? 'bg-primary-container text-on-primary-container'
              : 'text-on-surface-variant'
        }`

        return to ? (
          <Link key={label} to={to} aria-label={label} className={classes}>
            <span
              className="material-symbols-outlined"
              style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {icon}
            </span>
          </Link>
        ) : (
          <span
            key={label}
            aria-label={`${label} (coming later)`}
            className={`${classes} opacity-50`}
          >
            <span className="material-symbols-outlined">{icon}</span>
          </span>
        )
      })}
    </nav>
  )
}
