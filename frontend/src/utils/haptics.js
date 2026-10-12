/**
 * Haptic feedback utility for mobile devices using the Web Vibration API (navigator.vibrate).
 * Supports configurable patterns (selection, impact, heavy, success, warning, error)
 * and honors user preferences persisted in localStorage.
 */
const STORAGE_KEY = 'moodshare_haptics_enabled';

let isEnabledCached = null;

export function isPC(nav = typeof navigator !== 'undefined' ? navigator : undefined) {
  if (typeof window === 'undefined' && !nav) return false;
  if (!nav) return false;
  if (nav.userAgentData && typeof nav.userAgentData.mobile === 'boolean') {
    return !nav.userAgentData.mobile;
  }
  const ua = nav.userAgent || '';
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const isIPad = /Macintosh/i.test(ua) && (nav.maxTouchPoints || 0) > 1;
  return !isMobile && !isIPad;
}

export function isIOS(nav = typeof navigator !== 'undefined' ? navigator : undefined) {
  if (typeof window === 'undefined' && !nav) return false;
  if (!nav) return false;
  const ua = nav.userAgent || '';
  const isDirectIOS = /iPhone|iPad|iPod/i.test(ua);
  const isIPadOS = /Macintosh/i.test(ua) && (nav.maxTouchPoints || 0) > 1;
  return isDirectIOS || isIPadOS;
}

export function isHapticsSupported(nav = typeof navigator !== 'undefined' ? navigator : undefined) {
  if (typeof window === 'undefined' && !nav) return false;
  if (!nav) return false;
  if (isPC(nav)) return false;
  if (typeof nav.vibrate === 'function') return true;
  return isIOS(nav);
}

let iosSwitchLabel = null;

function getIOSSwitchLabel() {
  if (typeof document === 'undefined' || !document.body) return null;
  if (iosSwitchLabel && document.body.contains(iosSwitchLabel)) {
    return iosSwitchLabel;
  }
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = 'moodila-ios-haptic-switch';
  input.setAttribute('switch', '');
  input.setAttribute('aria-hidden', 'true');
  input.tabIndex = -1;
  input.style.position = 'fixed';
  input.style.top = '-9999px';
  input.style.left = '-9999px';
  input.style.opacity = '0';
  input.style.pointerEvents = 'none';

  const label = document.createElement('label');
  label.htmlFor = 'moodila-ios-haptic-switch';
  label.setAttribute('aria-hidden', 'true');
  label.style.position = 'fixed';
  label.style.top = '-9999px';
  label.style.left = '-9999px';
  label.style.opacity = '0';
  label.style.pointerEvents = 'none';

  document.body.appendChild(input);
  document.body.appendChild(label);
  iosSwitchLabel = label;
  return iosSwitchLabel;
}

export function triggerIOSHaptic() {
  try {
    const label = getIOSSwitchLabel();
    if (label) {
      label.click();
      return true;
    }
  } catch {
    // Ignore fallback errors
  }
  return false;
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
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      return navigator.vibrate(pattern);
    } catch {
      // Fall through to iOS trigger
    }
  }
  if (isIOS()) {
    triggerIOSHaptic();
    if (Array.isArray(pattern) && pattern.length > 2) {
      const delay = (pattern[0] || 0) + (pattern[1] || 0);
      setTimeout(() => triggerIOSHaptic(), Math.max(delay, 50));
    }
    return true;
  }
  return false;
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
   * Spooky rattle pulse [20ms, 40ms pause, 20ms, 40ms pause, 45ms] - for Halloween toggles & festive actions.
   */
  spooky() {
    return runVibrate([20, 40, 20, 40, 45]);
  },

  /**
   * Custom vibration pattern.
   */
  vibrate(pattern) {
    return runVibrate(pattern);
  },
};

export default haptics;
