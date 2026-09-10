export const REACTION_MAP = [
  { id: '❤️', icon: 'favorite', color: 'text-primary', label: 'Heart' },
  { id: '🫂', icon: 'diversity_1', color: 'text-secondary', label: 'Hug' },
  { id: '👏', icon: 'thumb_up', color: 'text-tertiary', label: 'Clap' },
  { id: '💡', icon: 'lightbulb', color: 'text-mood-meh', label: 'Idea' },
  { id: '😁', icon: 'sentiment_very_satisfied', color: 'text-mood-good', label: 'Joy' },
  { id: '🔥', icon: 'local_fire_department', color: 'text-mood-bad', label: 'Fire' },
]

export default function ReactionIcon({ reaction, className = 'text-[18px]', filled = true, style }) {
  const match = REACTION_MAP.find((r) => r.id === reaction || r.icon === reaction)
  if (!match) {
    return <span className={className}>{reaction}</span>
  }
  return (
    <span
      className={`material-symbols-outlined ${match.color} ${className}`}
      style={{
        ...(filled ? { fontVariationSettings: "'FILL' 1" } : {}),
        ...style,
      }}
    >
      {match.icon}
    </span>
  )
}
