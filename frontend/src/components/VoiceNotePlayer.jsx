import React, { useState, useRef, useEffect, useMemo } from 'react'
import { apiURL } from '../api/client'
import { notifyAudioPlaybackStarted, subscribeAudioPlaybackStart } from '../utils/audioManager'

const WAVEFORM_HEIGHTS = [
  35, 60, 40, 75, 50, 90, 65, 40, 80, 100, 70, 45, 85, 95, 60, 40, 75, 50, 85, 90, 60, 40, 55, 35, 65, 80, 45, 30
]

export default function VoiceNotePlayer({ audioUrl, blob, duration: initialDuration, onDelete, className = '' }) {
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(initialDuration || 0)
  const [speed, setSpeed] = useState(1)

  const src = useMemo(() => {
    if (blob) {
      return URL.createObjectURL(blob)
    }
    if (audioUrl) {
      return apiURL(audioUrl)
    }
    return ''
  }, [blob, audioUrl])

  useEffect(() => {
    return () => {
      if (blob && src) {
        URL.revokeObjectURL(src)
      }
    }
  }, [blob, src])

  useEffect(() => {
    if (initialDuration && initialDuration > 0) {
      setDuration(initialDuration)
    }
  }, [initialDuration])

  useEffect(() => {
    const unsubscribe = subscribeAudioPlaybackStart((source) => {
      if (audioRef.current && source !== audioRef.current) {
        audioRef.current.pause()
      }
    })
    return () => unsubscribe()
  }, [])

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const d = Math.round(audioRef.current.duration)
      if (!isNaN(d) && d > 0 && d !== Infinity) {
        setDuration(d)
      }
    }
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleEnded = () => {
    setIsPlaying(false)
    setCurrentTime(0)
  }

  const togglePlay = (e) => {
    if (e) e.stopPropagation()
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play().catch((err) => {
        console.error('Audio playback failed:', err)
        setIsPlaying(false)
      })
    }
  }

  const cycleSpeed = (e) => {
    if (e) e.stopPropagation()
    const nextSpeed = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1
    setSpeed(nextSpeed)
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed
    }
  }

  const handleSeek = (index, e) => {
    if (e) e.stopPropagation()
    if (!audioRef.current || !duration || isNaN(duration)) return
    const targetRatio = (index + 1) / WAVEFORM_HEIGHTS.length
    const targetTime = targetRatio * duration
    audioRef.current.currentTime = targetTime
    setCurrentTime(targetTime)
  }

  const formatTime = (secs) => {
    if (!secs || isNaN(secs) || secs < 0) return '0:00'
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0
  const activeBarIndex = Math.floor(progress * WAVEFORM_HEIGHTS.length)

  return (
    <div
      className={`relative flex flex-col gap-xs rounded-[20px] bg-surface-container-low p-md border border-surface-container-high/60 cloud-shadow ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <audio
        ref={audioRef}
        src={src}
        onPlay={() => {
          setIsPlaying(true)
          if (audioRef.current) {
            notifyAudioPlaybackStarted(audioRef.current)
          }
        }}
        onPause={() => setIsPlaying(false)}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={(e) => {
          console.error('Audio element error:', e)
          setIsPlaying(false)
        }}
        preload="metadata"
      />

      <div className="flex items-center gap-md">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause voice note' : 'Play voice note'}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary shadow-sm transition-transform active:scale-95 hover:bg-primary/90"
        >
          <span className="material-symbols-outlined text-[24px]">
            {isPlaying ? 'pause' : 'play_arrow'}
          </span>
        </button>

        {/* Waveform & Info */}
        <div className="flex flex-1 flex-col gap-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-label-sm font-medium text-on-surface-variant font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            <div className="flex items-center gap-xs">
              <button
                type="button"
                onClick={cycleSpeed}
                title="Playback speed"
                className="rounded-md bg-surface-container px-1.5 py-0.5 text-[11px] font-semibold text-primary hover:bg-surface-container-high"
              >
                {speed}x
              </button>
              {onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (audioRef.current) {
                      audioRef.current.pause()
                    }
                    onDelete()
                  }}
                  title="Remove voice note"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                </button>
              )}
            </div>
          </div>

          {/* Interactive Waveform Bars */}
          <div
            className="flex h-7 w-full items-center gap-[3px] cursor-pointer py-1"
            role="slider"
            aria-label="Audio progress"
            aria-valuenow={Math.round(currentTime)}
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
          >
            {WAVEFORM_HEIGHTS.map((heightPercent, idx) => {
              const isActive = idx <= activeBarIndex && (currentTime > 0 || isPlaying)
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => handleSeek(idx, e)}
                  className="group flex-1 flex h-full items-center justify-center focus:outline-none"
                >
                  <span
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full rounded-full transition-colors duration-150 ${
                      isActive ? 'bg-primary' : 'bg-surface-container-highest hover:bg-outline-variant'
                    }`}
                  />
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
