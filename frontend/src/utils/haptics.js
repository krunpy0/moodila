/**
 * Haptic feedback utility for mobile devices using the Web Vibration API (navigator.vibrate).
 * Supports configurable patterns (selection, impact, heavy, success, warning, error)
 * and honors user preferences persisted in localStorage.
 */
const STORAGE_KEY = 'moodshare_haptics_enabled';

let isEnabledCached = null;

export function isHapticsSupported() {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function'
  );
}

export function isHapticsEnabled() {
  if (isEnabledCached !== null) return isEnabledCached;
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    // Enabled by default unless explicitly set to 'false'
    isEnabledCached = val === null ? true : val === 'true';
  } catch {
    isEnabledCached = true;
  }
  return isEnabledCached;
}

export function setHapticsEnabled(enabled) {
  isEnabledCached = Boolean(enabled);
  try {
    localStorage.setItem(STORAGE_KEY, String(isEnabledCached));
  } catch {
    // Fallback if storage unavailable
  }
  // Dispatch a custom event so UI components or settings can re-render if needed
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('moodshare_haptics_changed', { detail: { enabled: isEnabledCached } }));
  }
}

function runVibrate(pattern) {
  if (!isHapticsEnabled() || !isHapticsSupported()) return false;
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

export const haptics = {
  /**
   * Ultra-light crisp tick (10ms) - ideal for tab switches, day clicks, tag toggles, chips.
   */
  selection() {
    return runVibrate(10);
  },

  /**
   * Medium impact bump (25ms) - ideal for mood selection, like/reaction clicks, switches.
   */
  impact() {
    return runVibrate(25);
  },

  /**
   * Deep press pulse (45ms) - ideal for long-press trigger, modal opens.
   */
  heavy() {
    return runVibrate(45);
  },

  /**
   * Pleasant ascending double-pulse [15ms, 50ms pause, 25ms] - for successful save, posting, sending.
   */
  success() {
    return runVibrate([15, 50, 25]);
  },

  /**
   * Warning double-pulse [25ms, 40ms pause, 25ms] - for deletion, destructive warnings, cancel.
   */
  warning() {
    return runVibrate([25, 40, 25]);
  },

  /**
   * Error pulse pattern [35ms, 40ms pause, 35ms, 40ms pause, 50ms] - for form validation error or failure.
   */
  error() {
    return runVibrate([35, 40, 35, 40, 50]);
  },

  /**
   * Voice recording start pulse (30ms).
   */
  recordStart() {
    return runVibrate(30);
  },

  /**
   * Voice recording stop double-pulse [15ms, 30ms pause, 15ms].
   */
  recordStop() {
    return runVibrate([15, 30, 15]);
  },

  /**
   * Custom vibration pattern.
   */
  vibrate(pattern) {
    return runVibrate(pattern);
  },
};

export default haptics;
