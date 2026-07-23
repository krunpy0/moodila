import type { CSSProperties } from 'react'

type SkeletonProps = {
  width?: CSSProperties['width']
  height?: CSSProperties['height']
  borderRadius?: CSSProperties['borderRadius']
  className?: string
}

export default function Skeleton({
  width = '100%',
  height = '1rem',
  borderRadius = '0.5rem',
  className = '',
}: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={`skeleton block ${className}`.trim()}
      style={{ width, height, borderRadius }}
    />
  )
}
