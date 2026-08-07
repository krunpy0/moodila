const AUDIO_PLAYBACK_EVENT = 'moodshare:audio-playback-start'

export function notifyAudioPlaybackStarted(audioElement) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(AUDIO_PLAYBACK_EVENT, {
      detail: { source: audioElement },
    })
  )
}

export function subscribeAudioPlaybackStart(callback) {
  if (typeof window === 'undefined') return () => {}
  const handler = (event) => {
    if (event.detail && event.detail.source) {
      callback(event.detail.source)
    }
  }
  window.addEventListener(AUDIO_PLAYBACK_EVENT, handler)
  return () => {
    window.removeEventListener(AUDIO_PLAYBACK_EVENT, handler)
  }
}
