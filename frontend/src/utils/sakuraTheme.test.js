import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getThemeById,
  isDarkTheme,
  getFamilyCounterpartTheme,
  THEME_FAMILIES,
} from './themes.js'

function luminance(hex) {
  const rgb = hex.replace('#', '').match(/.{2}/g).map((x) => parseInt(x, 16) / 255)
  const a = rgb.map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)))
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]
}

function contrastRatio(hex1, hex2) {
  const l1 = luminance(hex1)
  const l2 = luminance(hex2)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

test('Sakura theme family is registered properly', () => {
  const family = THEME_FAMILIES.sakura
  assert.ok(family, 'sakura family must exist')
  assert.equal(family.id, 'sakura')
  assert.equal(family.ru, 'Сакура')
  assert.equal(family.en, 'Cherry Blossom')
})

test('Sakura light and dark themes exist with correct modes and metadata', () => {
  const light = getThemeById('sakura-light')
  assert.ok(light, 'sakura-light must exist')
  assert.equal(light.mode, 'light')
  assert.equal(light.family, 'sakura')
  assert.equal(light.metaColor, '#FFF4F6')
  assert.equal(isDarkTheme('sakura-light'), false)

  const dark = getThemeById('sakura-dark')
  assert.ok(dark, 'sakura-dark must exist')
  assert.equal(dark.mode, 'dark')
  assert.equal(dark.family, 'sakura')
  assert.equal(dark.metaColor, '#1B1216')
  assert.equal(isDarkTheme('sakura-dark'), true)
})

test('Counterpart theme switching works between sakura-light and sakura-dark', () => {
  assert.equal(getFamilyCounterpartTheme('sakura-light'), 'sakura-dark')
  assert.equal(getFamilyCounterpartTheme('sakura-dark'), 'sakura-light')
})

test('Contrast verification: Light theme normal text >= 4.5:1', () => {
  // text-primary (#3B2530)
  const textPrimaryOnBg = contrastRatio('#3B2530', '#FFF4F6')
  assert.ok(textPrimaryOnBg >= 4.5, `text-primary on bg: ${textPrimaryOnBg} must be >= 4.5`)

  const textPrimaryOnCard = contrastRatio('#3B2530', '#FFFFFF')
  assert.ok(textPrimaryOnCard >= 4.5, `text-primary on card: ${textPrimaryOnCard} must be >= 4.5`)

  const textPrimaryOnChip = contrastRatio('#3B2530', '#F9E8EC')
  assert.ok(textPrimaryOnChip >= 4.5, `text-primary on chip: ${textPrimaryOnChip} must be >= 4.5`)

  // text-secondary (#7D626B)
  const textSecondaryOnBg = contrastRatio('#7D626B', '#FFF4F6')
  assert.ok(textSecondaryOnBg >= 4.5, `text-secondary on bg: ${textSecondaryOnBg} must be >= 4.5`)

  const textSecondaryOnCard = contrastRatio('#7D626B', '#FFFFFF')
  assert.ok(textSecondaryOnCard >= 4.5, `text-secondary on card: ${textSecondaryOnCard} must be >= 4.5`)

  const textSecondaryOnChip = contrastRatio('#7D626B', '#F9E8EC')
  assert.ok(textSecondaryOnChip >= 4.5, `text-secondary on chip: ${textSecondaryOnChip} must be >= 4.5`)

  // on-accent (#FFFFFF) on accent (#BE4668)
  const onAccentRatio = contrastRatio('#FFFFFF', '#BE4668')
  assert.ok(onAccentRatio >= 4.5, `on-accent on accent: ${onAccentRatio} must be >= 4.5`)
})

test('Contrast verification: Dark theme normal text >= 4.5:1', () => {
  // text-primary (#F7E9EE)
  const textPrimaryOnBg = contrastRatio('#F7E9EE', '#1B1216')
  assert.ok(textPrimaryOnBg >= 4.5, `text-primary on bg: ${textPrimaryOnBg} must be >= 4.5`)

  const textPrimaryOnCard = contrastRatio('#F7E9EE', '#261A20')
  assert.ok(textPrimaryOnCard >= 4.5, `text-primary on card: ${textPrimaryOnCard} must be >= 4.5`)

  const textPrimaryOnChip = contrastRatio('#F7E9EE', '#34242C')
  assert.ok(textPrimaryOnChip >= 4.5, `text-primary on chip: ${textPrimaryOnChip} must be >= 4.5`)

  // text-secondary (#B79AA5)
  const textSecondaryOnBg = contrastRatio('#B79AA5', '#1B1216')
  assert.ok(textSecondaryOnBg >= 4.5, `text-secondary on bg: ${textSecondaryOnBg} must be >= 4.5`)

  const textSecondaryOnCard = contrastRatio('#B79AA5', '#261A20')
  assert.ok(textSecondaryOnCard >= 4.5, `text-secondary on card: ${textSecondaryOnCard} must be >= 4.5`)

  const textSecondaryOnChip = contrastRatio('#B79AA5', '#34242C')
  assert.ok(textSecondaryOnChip >= 4.5, `text-secondary on chip: ${textSecondaryOnChip} must be >= 4.5`)

  // on-accent (#3B1523) on accent (#F2A3BA)
  const onAccentRatio = contrastRatio('#3B1523', '#F2A3BA')
  assert.ok(onAccentRatio >= 4.5, `on-accent on accent: ${onAccentRatio} must be >= 4.5`)

  // accent on accent-soft (#4A2A38)
  const accentOnSoft = contrastRatio('#F2A3BA', '#4A2A38')
  assert.ok(accentOnSoft >= 4.5, `accent on accent-soft: ${accentOnSoft} must be >= 4.5`)
})
