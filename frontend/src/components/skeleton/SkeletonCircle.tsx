import Skeleton from './Skeleton'

type SkeletonCircleProps = { size?: string | number; className?: string }

export default function SkeletonCircle({ size = '3rem', className = '' }: SkeletonCircleProps) {
  return <Skeleton width={size} height={size} borderRadius="9999px" className={className} />
}
