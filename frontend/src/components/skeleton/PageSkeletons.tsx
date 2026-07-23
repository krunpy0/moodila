import Skeleton from './Skeleton'
import SkeletonCircle from './SkeletonCircle'
import SkeletonText from './SkeletonText'

export function HomeSkeleton() {
  return <div className="space-y-lg" role="status" aria-label="Loading your journal">
    <section className="rounded-[24px] bg-primary-container p-lg cloud-shadow"><Skeleton width="58%" height="2rem" /><Skeleton className="mt-md" width="9.5rem" height="2.5rem" borderRadius="9999px" /></section>
    <section className="space-y-md"><div className="flex justify-between"><Skeleton width="8rem" height="1rem" /><Skeleton width="3.5rem" height="0.875rem" /></div><div className="flex justify-between gap-sm rounded-[24px] bg-white/40 p-md cloud-shadow">{Array.from({ length: 7 }, (_, i) => <div key={i} className="flex flex-col items-center gap-xs"><SkeletonCircle size="3rem" /><Skeleton width="1.75rem" height="0.75rem" /></div>)}</div></section>
    <section className="grid grid-cols-2 gap-md"><div className="col-span-2 rounded-[24px] bg-white p-lg cloud-shadow"><Skeleton width="9rem" height="1.75rem" /><Skeleton className="mt-sm" width="5rem" height="2.5rem" /><Skeleton className="mt-xs" width="13rem" height="0.875rem" /></div>{Array.from({ length: 2 }, (_, i) => <div key={i} className="min-h-[140px] rounded-[24px] bg-surface-container-low p-lg"><Skeleton width="70%" height="0.75rem" /><Skeleton className="mt-auto translate-y-14" width="80%" height="1.75rem" /></div>)}</section>
    <section className="space-y-md"><div className="flex justify-between"><Skeleton width="7rem" height="1rem" /><Skeleton width="5rem" height="1.5rem" borderRadius="9999px" /></div><div className="space-y-sm">{Array.from({ length: 2 }, (_, i) => <EntrySkeleton key={i} />)}</div></section>
  </div>
}

export function CalendarSkeleton() {
  return <div className="space-y-lg" role="status" aria-label="Loading calendar"><div className="flex gap-1 rounded-full bg-surface-container-low p-1"><Skeleton height="2.5rem" borderRadius="9999px" /><Skeleton height="2.5rem" borderRadius="9999px" /></div><div className="flex items-center justify-between"><SkeletonCircle size="2.5rem" /><Skeleton width="10rem" height="1.75rem" /><SkeletonCircle size="2.5rem" /></div><div className="grid grid-cols-7 gap-y-0">{Array.from({ length: 7 }, (_, i) => <Skeleton key={`label-${i}`} className="mx-auto mb-sm" width="1.25rem" height="0.75rem" />)}{Array.from({ length: 42 }, (_, i) => <div key={i} className="flex h-[76px] flex-col items-center gap-1"><Skeleton width="1rem" height="0.875rem" /><SkeletonCircle size="2.5rem" /></div>)}</div></div>
}

export function FeedSkeleton() {
  return <div className="space-y-md" role="status" aria-label="Loading your friends' moments">{Array.from({ length: 5 }, (_, i) => <FeedCardSkeleton key={i} />)}</div>
}

export function FriendsSkeleton() {
  return <div className="space-y-lg" role="status" aria-label="Loading friends"><Skeleton width="9rem" height="1rem" />{Array.from({ length: 3 }, (_, i) => <FriendRowSkeleton key={i} />)}<Skeleton width="7rem" height="1rem" />{Array.from({ length: 3 }, (_, i) => <FriendRowSkeleton key={i} />)}</div>
}

export function ProfileSkeleton() {
  return <div className="space-y-8" role="status" aria-label="Loading profile"><section className="flex flex-col items-center"><SkeletonCircle size="7rem" /><Skeleton className="mt-md" width="11rem" height="2.5rem" /><Skeleton className="mt-xs" width="7rem" height="1rem" /></section><section><div className="mb-md flex justify-between"><Skeleton width="9rem" height="1.75rem" /><Skeleton width="3.5rem" height="1rem" /></div><div className="grid grid-cols-2 gap-md">{Array.from({ length: 4 }, (_, i) => <div key={i} className="min-h-[140px] rounded-[24px] bg-white p-lg cloud-shadow"><Skeleton width="45%" height="0.75rem" /><Skeleton className="mt-10" width="100%" height="0.875rem" /><Skeleton className="mt-xs" width="72%" height="0.875rem" /></div>)}</div></section><section className="rounded-[24px] bg-white p-lg cloud-shadow"><Skeleton width="5rem" height="1rem" /><div className="mt-md space-y-sm">{Array.from({ length: 3 }, (_, i) => <div key={i} className="flex items-center gap-sm"><SkeletonCircle size="2.5rem" /><div className="flex-1"><Skeleton width="55%" height="1rem" /><Skeleton className="mt-xs" width="36%" height="0.75rem" /></div></div>)}</div></section></div>
}

function EntrySkeleton() { return <div className="flex min-h-[88px] items-center gap-md rounded-[24px] bg-white p-md cloud-shadow"><Skeleton borderRadius="20px" width="3.5rem" height="3.5rem" /><div className="flex-1"><Skeleton width="55%" height="1rem" /><Skeleton className="mt-xs" width="88%" height="0.875rem" /></div></div> }
function FeedCardSkeleton() { return <article className="rounded-[24px] bg-white p-lg cloud-shadow"><div className="flex items-center gap-sm"><SkeletonCircle /><div className="flex-1"><Skeleton width="45%" height="1rem" /><Skeleton className="mt-xs" width="62%" height="0.75rem" /></div><SkeletonCircle size="2.75rem" /></div><div className="mt-md"><Skeleton width="5rem" height="1.75rem" borderRadius="9999px" /><SkeletonText className="mt-sm" lines={2} /></div><Skeleton className="mt-md" width="4.5rem" height="1.75rem" borderRadius="9999px" /></article> }
function FriendRowSkeleton() { return <div className="flex min-h-[112px] items-center gap-md rounded-[24px] bg-white p-lg cloud-shadow"><SkeletonCircle size="3.5rem" /><div className="flex-1"><Skeleton width="52%" height="1rem" /><Skeleton className="mt-xs" width="36%" height="0.75rem" /></div><SkeletonCircle size="2.5rem" /></div> }
