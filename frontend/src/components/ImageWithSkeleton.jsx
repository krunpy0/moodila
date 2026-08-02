import { useState, useEffect } from 'react'

export default function ImageWithSkeleton({
  src,
  alt = '',
  className = 'w-full h-auto object-contain',
  containerClassName = '',
  skeletonHeightClass = 'h-48 sm:h-64',
  isUploading = false,
  uploadingText = 'Uploading photo...',
  children,
  ...props
}) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoaded(false)
    setError(false)
  }, [src])

  const showSkeleton = isUploading || (!loaded && !error && Boolean(src))

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-surface-container-low ${containerClassName}`.trim()}>
      {/* Skeleton view while loading or uploading */}
      {showSkeleton && (
        <div
          className={`flex w-full items-center justify-center bg-surface-container-high animate-pulse ${skeletonHeightClass}`}
          aria-hidden="true"
        >
          <div className="flex flex-col items-center gap-xs text-on-surface-variant/50">
            <span className="material-symbols-outlined text-[36px] animate-pulse">
              {isUploading ? 'cloud_upload' : 'image'}
            </span>
            {isUploading && (
              <span className="text-label-sm font-label-sm">{uploadingText}</span>
            )}
          </div>
        </div>
      )}

      {/* Actual image */}
      {src && !error && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={`${className} ${
            loaded && !isUploading
              ? 'opacity-100 transition-opacity duration-300'
              : 'absolute inset-0 h-full w-full opacity-0 pointer-events-none'
          }`}
          {...props}
        />
      )}

      {/* Optional overlay children e.g. remove photo button */}
      {children}
    </div>
  )
}
