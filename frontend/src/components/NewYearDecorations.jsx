import { useTheme } from '../context/ThemeContext'
import './NewYearDecorations.css'

const flakes = [[7, 9, 12], [91, 18, 15], [4, 35, 16], [95, 52, 12], [6, 76, 13], [90, 89, 17], [31, 3, 11]]

export default function NewYearDecorations() {
  const { theme } = useTheme()
  const active = theme.startsWith('new-year-')
  if (!active) return null

  return (
    <div className="winter-background" aria-hidden="true">
      {flakes.map(([left, top, size]) => <svg key={`${left}-${top}`} viewBox="0 0 24 24"
        style={{ left: `${left}%`, top: `${top}%`, width: size, height: size }}>
        <g fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
          {[0, 60, 120].map(angle => <path key={angle} transform={`rotate(${angle} 12 12)`}
            d="M12 2v20M8.5 4.5 12 8l3.5-3.5M8.5 19.5 12 16l3.5 3.5" />)}
        </g>
      </svg>)}
    </div>

  )
}
