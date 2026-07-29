import { MOODS } from '../utils/moods'

export default function MoodIcon({ mood, className = 'text-[24px]', filled = true, style }) {
  const info = MOODS[mood] || MOODS[3]
  return (
    <span
      className={`material-symbols-outlined ${info.color} ${className}`}
      style={{
        ...(filled ? { fontVariationSettings: "'FILL' 1" } : {}),
        ...style,
      }}
    >
      {info.icon}
    </span>
  )
}
