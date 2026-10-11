import test from 'node:test'
import assert from 'node:assert/strict'
import { isPC, isHapticsSupported } from './haptics.js'

test('isPC detects desktop PC user agents correctly', () => {
  // Windows PC Chrome
  assert.equal(
    isPC({
      userAgentData: { mobile: false },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }),
    true,
    'Windows Chrome should be detected as PC'
  )

  // Windows PC Firefox
  assert.equal(
    isPC({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    }),
    true,
    'Windows Firefox should be detected as PC'
  )

  // Mac Safari Desktop
  assert.equal(
    isPC({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      maxTouchPoints: 0,
    }),
    true,
    'Mac Safari should be detected as PC'
  )

  // Linux PC Chrome
  assert.equal(
    isPC({
      userAgentData: { mobile: false },
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }),
    true,
    'Linux PC should be detected as PC'
  )
})

test('isPC detects mobile and tablet devices correctly', () => {
  // Android Mobile Chrome
  assert.equal(
    isPC({
      userAgentData: { mobile: true },
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    }),
    false,
    'Android phone should not be detected as PC'
  )

  // iPhone Safari
  assert.equal(
    isPC({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    }),
    false,
    'iPhone should not be detected as PC'
  )

  // iPad Safari (Desktop UA mode with touch points)
  assert.equal(
    isPC({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      maxTouchPoints: 5,
    }),
    false,
    'iPad should not be detected as PC'
  )
})

test('isHapticsSupported returns false on PC even if navigator.vibrate is defined', () => {
  const desktopChromeNav = {
    userAgentData: { mobile: false },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    vibrate: () => true,
  }

  // Node environment without window
  assert.equal(
    isHapticsSupported(desktopChromeNav),
    false,
    'Haptics must not be reported as supported on PC'
  )
})
