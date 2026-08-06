import { useState, useEffect } from 'react'
import ImageModal from './ImageModal'

export default function ImageWithSkeleton({
  src,
  alt = '',
  className = 'w-full h-auto object-contain',
  containerClassName = '',
  skeletonHeightClass = 'h-48 sm:h-64',
  isUploading = false,
  uploadingText = 'Uploading photo...',
  children,
  enableFullscreen = true,
  onClick,
  ...props
}) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false)

  useEffect(() => {
    setLoaded(false)
    setError(false)
  }, [src])

  const showSkeleton = isUploading || (!loaded && !error && Boolean(src))
  const canFullscreen = enableFullscreen && loaded && !isUploading && Boolean(src) && !error

  const handleContainerClick = (e) => {
    if (onClick) {
      onClick(e)
    }
    if (canFullscreen) {
      setIsFullscreenOpen(true)
    }
  }

  return (
    <>
      <div
        className={`relative overflow-hidden rounded-2xl bg-surface-container-low ${
          canFullscreen ? 'cursor-pointer group' : ''
        } ${containerClassName}`.trim()}
        onClick={handleContainerClick}
      >
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

        {/* Fullscreen hover indicator badge */}
        {canFullscreen && (
          <div className="absolute right-2 top-2 z-[5] opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-xs shadow-md">
              <span className="material-symbols-outlined text-[18px]">fullscreen</span>
            </span>
          </div>
        )}

        {/* Optional overlay children e.g. remove photo button */}
        {children}
      </div>

      {/* Fullscreen modal */}
      {enableFullscreen && (
        <ImageModal
          src={src}
          alt={alt}
          isOpen={isFullscreenOpen}
          onClose={() => setIsFullscreenOpen(false)}
        />
      )}
    </>
  )
}

