import Skeleton from './Skeleton'

type SkeletonTextProps = { lines?: number; className?: string }

export default function SkeletonText({ lines = 2, className = '' }: SkeletonTextProps) {
  const widths = ['100%', '84%', '63%', '91%']
  return (
    <div aria-hidden="true" className={`space-y-xs ${className}`.trim()}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} width={widths[index % widths.length]} height="0.875rem" borderRadius="9999px" />
      ))}
    </div>
  )
}
