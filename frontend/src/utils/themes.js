/**
 * Moodila Theme System Specification & Metadata
 * 
 * Defines 6 theme families, each with Light and Dark variants (12 themes total).
 * All tokens are authored as CSS variables in `src/index.css`.
 */

export const THEME_FAMILIES = {
  classic: {
    id: 'classic',
    ru: 'Классическая',
    en: 'Soft Editorial',
    descRu: 'Теплый редакционный стиль, мягкая бумага и приглушенная роза',
    descEn: 'Warm editorial paper with dusty rose and calm slate tones',
  },
  halloween: {
    id: 'halloween',
    ru: 'Хеллоуин',
    en: 'Spooky Autumn',
    descRu: 'Пряная тыква, мистический аметист и мерцание свечей в ночи',
    descEn: 'Roasted pumpkin, mystical amethyst, and glowing candlelit vibes',
  },
  forest: {
    id: 'forest',
    ru: 'Лес и матча',
    en: 'Pine & Matcha',
    descRu: 'Шалфей, хвоя, чай матча и медитативный природный покой',
    descEn: 'Sage, pine needles, matcha tea, and grounded natural stillness',
  },
  ocean: {
    id: 'ocean',
    ru: 'Океанский бриз',
    en: 'Ocean Breeze',
    descRu: 'Морская глубина, лазурный бриз и кристальная свежесть',
    descEn: 'Deep waters, azure tides, and crisp coastal clarity',
  },
  lavender: {
    id: 'lavender',
    ru: 'Закатная лаванда',
    en: 'Sunset Lavender',
    descRu: 'Вечерние сумерки, аметистовая нежность и уютная рефлексия',
    descEn: 'Dusk twilight, amethyst softness, and cozy evening reflection',
  },
  terracotta: {
    id: 'terracotta',
    ru: 'Тёплый очаг',
    en: 'Amber Hearth',
    descRu: 'Глиняная керамика, пряности, тепло домашнего камина',
    descEn: 'Terracotta clay, warm spices, and crackling fireside comfort',
  },
  aurora: {
    id: 'aurora',
    ru: 'Северное сияние',
    en: 'Aurora Glow',
    descRu: 'Полярное сияние, люминесцентный изумруд и космическая магия',
    descEn: 'Polar lights, luminescent emerald, and crisp night wonder',
  },
}

export const THEMES = [
  // 1. Classic Light
  {
    id: 'light',
    family: 'classic',
    mode: 'light',
    nameRu: 'Классическая (Светлая)',
    nameEn: 'Soft Editorial (Light)',
    metaColor: '#F8F7F5',
    colors: {
      bg: '#F8F7F5',
      surface: '#FFFFFF',
      surfaceContainer: '#F3F1EE',
      primary: '#8C5C70',
      onPrimary: '#FFFFFF',
      secondary: '#61727A',
      tertiary: '#8A7642',
      onSurface: '#181817',
      onSurfaceVariant: '#6A6661',
      border: '#D8D4CF',
      moods: ['#357756', '#658A42', '#A97C2F', '#BF6A3C', '#B65156'],
    },
  },
  // 2. Classic Dark
  {
    id: 'dark',
    family: 'classic',
    mode: 'dark',
    nameRu: 'Классическая (Тёмная)',
    nameEn: 'Soft Editorial (Dark)',
    metaColor: '#171615',
    colors: {
      bg: '#171615',
      surface: '#222120',
      surfaceContainer: '#292827',
      primary: '#D8A1B5',
      onPrimary: '#402331',
      secondary: '#A8BBC1',
      tertiary: '#D0BE83',
      onSurface: '#F1EFEC',
      onSurfaceVariant: '#B9B4AE',
      border: '#484541',
      moods: ['#68B88F', '#9FC479', '#DFAD5E', '#DC885D', '#D7787D'],
    },
  },

  // 3. Halloween Light (Autumn Harvest Spiced Parchment)
  {
    id: 'halloween-light',
    family: 'halloween',
    mode: 'light',
    nameRu: 'Хеллоуин (Светлая)',
    nameEn: 'Spooky Autumn (Light)',
    metaColor: '#F8F3EB',
    colors: {
      bg: '#F8F3EB',
      surface: '#FFFFFF',
      surfaceContainer: '#F4EEE5',
      primary: '#CC5218',
      onPrimary: '#FFFFFF',
      secondary: '#526E5D',
      tertiary: '#7D4E87',
      onSurface: '#1C1816',
      onSurfaceVariant: '#70645C',
      border: '#DCD3C8',
      moods: ['#2D7D50', '#738732', '#BE7D23', '#C35A2D', '#B93C46'],
    },
  },
  // 4. Halloween Dark (Gothic Midnight & Pumpkin Ember)
  {
    id: 'halloween-dark',
    family: 'halloween',
    mode: 'dark',
    nameRu: 'Хеллоуин (Тёмная)',
    nameEn: 'Spooky Autumn (Dark)',
    metaColor: '#131016',
    colors: {
      bg: '#131016',
      surface: '#1F1A24',
      surfaceContainer: '#26202C',
      primary: '#F67C2D',
      onPrimary: '#240E03',
      secondary: '#88C6A2',
      tertiary: '#C48EE2',
      onSurface: '#F5F0EC',
      onSurfaceVariant: '#BCB2BE',
      border: '#42384A',
      moods: ['#70CD98', '#ACCD6E', '#F2B656', '#EB8250', '#E66E76'],
    },
  },

  // 5. Forest Light
  {
    id: 'forest-light',
    family: 'forest',
    mode: 'light',
    nameRu: 'Лес и матча (Светлая)',
    nameEn: 'Pine & Matcha (Light)',
    metaColor: '#F3F6F2',
    colors: {
      bg: '#F3F6F2',
      surface: '#FFFFFF',
      surfaceContainer: '#E7EEE6',
      primary: '#2E6845',
      onPrimary: '#FFFFFF',
      secondary: '#5C7C6D',
      tertiary: '#8E6B47',
      onSurface: '#142218',
      onSurfaceVariant: '#4E6253',
      border: '#CCD8CD',
      moods: ['#2E6845', '#55873C', '#A87A28', '#BA6536', '#B24D54'],
    },
  },
  // 4. Forest Dark
  {
    id: 'forest-dark',
    family: 'forest',
    mode: 'dark',
    nameRu: 'Лес и матча (Тёмная)',
    nameEn: 'Pine & Matcha (Dark)',
    metaColor: '#111813',
    colors: {
      bg: '#111813',
      surface: '#18221B',
      surfaceContainer: '#202C24',
      primary: '#5EBF85',
      onPrimary: '#082815',
      secondary: '#8FB09D',
      tertiary: '#D1AB7B',
      onSurface: '#EDF3EE',
      onSurfaceVariant: '#9DB3A3',
      border: '#2E3E33',
      moods: ['#5EBF85', '#98C96C', '#DCB25E', '#D98254', '#D66D74'],
    },
  },

  // 5. Ocean Light
  {
    id: 'ocean-light',
    family: 'ocean',
    mode: 'light',
    nameRu: 'Океанский бриз (Светлая)',
    nameEn: 'Ocean Breeze (Light)',
    metaColor: '#F1F5F8',
    colors: {
      bg: '#F1F5F8',
      surface: '#FFFFFF',
      surfaceContainer: '#E2ECF2',
      primary: '#20638C',
      onPrimary: '#FFFFFF',
      secondary: '#3C7E82',
      tertiary: '#9C753A',
      onSurface: '#0F1E28',
      onSurfaceVariant: '#4B6171',
      border: '#C7D7E2',
      moods: ['#207E6C', '#4F8840', '#AA7C30', '#BE663E', '#B54F5D'],
    },
  },
  // 6. Ocean Dark
  {
    id: 'ocean-dark',
    family: 'ocean',
    mode: 'dark',
    nameRu: 'Океанский бриз (Тёмная)',
    nameEn: 'Ocean Breeze (Dark)',
    metaColor: '#0E161C',
    colors: {
      bg: '#0E161C',
      surface: '#152028',
      surfaceContainer: '#1C2B36',
      primary: '#4FAEDB',
      onPrimary: '#072638',
      secondary: '#66BDBC',
      tertiary: '#E2BA7A',
      onSurface: '#ECF3F8',
      onSurfaceVariant: '#95AFC1',
      border: '#263847',
      moods: ['#4FD2A8', '#86C566', '#E4B85E', '#DF8761', '#DD717D'],
    },
  },

  // 7. Lavender Light
  {
    id: 'lavender-light',
    family: 'lavender',
    mode: 'light',
    nameRu: 'Закатная лаванда (Светлая)',
    nameEn: 'Sunset Lavender (Light)',
    metaColor: '#F6F3F8',
    colors: {
      bg: '#F6F3F8',
      surface: '#FFFFFF',
      surfaceContainer: '#ECE5F1',
      primary: '#7B4B8B',
      onPrimary: '#FFFFFF',
      secondary: '#965768',
      tertiary: '#936E35',
      onSurface: '#211526',
      onSurfaceVariant: '#64536D',
      border: '#D7CBDE',
      moods: ['#327D5C', '#608638', '#A6792A', '#BD6348', '#AC4865'],
    },
  },
  // 8. Lavender Dark
  {
    id: 'lavender-dark',
    family: 'lavender',
    mode: 'dark',
    nameRu: 'Закатная лаванда (Тёмная)',
    nameEn: 'Sunset Lavender (Dark)',
    metaColor: '#18121D',
    colors: {
      bg: '#18121D',
      surface: '#211A29',
      surfaceContainer: '#2B2236',
      primary: '#BC84D7',
      onPrimary: '#301040',
      secondary: '#DE98AA',
      tertiary: '#E0BA7A',
      onSurface: '#F4EEF7',
      onSurfaceVariant: '#B4A2BD',
      border: '#3E304C',
      moods: ['#65BF91', '#A0C668', '#E0B259', '#E08368', '#D66D8E'],
    },
  },

  // 9. Terracotta Light
  {
    id: 'terracotta-light',
    family: 'terracotta',
    mode: 'light',
    nameRu: 'Тёплый очаг (Светлая)',
    nameEn: 'Amber Hearth (Light)',
    metaColor: '#F9F5F0',
    colors: {
      bg: '#F9F5F0',
      surface: '#FFFFFF',
      surfaceContainer: '#EFE4D7',
      primary: '#9B492B',
      onPrimary: '#FFFFFF',
      secondary: '#8C6339',
      tertiary: '#5E7350',
      onSurface: '#261A14',
      onSurfaceVariant: '#6C564A',
      border: '#DDD0C0',
      moods: ['#3A784C', '#678635', '#A97A28', '#B75F34', '#AF4A4D'],
    },
  },
  // 10. Terracotta Dark
  {
    id: 'terracotta-dark',
    family: 'terracotta',
    mode: 'dark',
    nameRu: 'Тёплый очаг (Тёмная)',
    nameEn: 'Amber Hearth (Dark)',
    metaColor: '#1A1310',
    colors: {
      bg: '#1A1310',
      surface: '#241B17',
      surfaceContainer: '#30241E',
      primary: '#EB7C59',
      onPrimary: '#3B1407',
      secondary: '#D9A168',
      tertiary: '#9FB78F',
      onSurface: '#FAF2EC',
      onSurfaceVariant: '#C0A79A',
      border: '#44332A',
      moods: ['#6FBF82', '#A4C664', '#E2B45A', '#E38052', '#D86C70'],
    },
  },

  // 11. Aurora Light
  {
    id: 'aurora-light',
    family: 'aurora',
    mode: 'light',
    nameRu: 'Северное сияние (Светлая)',
    nameEn: 'Aurora Glow (Light)',
    metaColor: '#F1F7F6',
    colors: {
      bg: '#F1F7F6',
      surface: '#FFFFFF',
      surfaceContainer: '#DEECE8',
      primary: '#1A6E64',
      onPrimary: '#FFFFFF',
      secondary: '#33658A',
      tertiary: '#8F4B66',
      onSurface: '#10211F',
      onSurfaceVariant: '#46615D',
      border: '#C1D7D2',
      moods: ['#1A8574', '#4E883C', '#A87928', '#BA6542', '#B24B6B'],
    },
  },
  // 12. Aurora Dark
  {
    id: 'aurora-dark',
    family: 'aurora',
    mode: 'dark',
    nameRu: 'Северное сияние (Тёмная)',
    nameEn: 'Aurora Glow (Dark)',
    metaColor: '#0C1414',
    colors: {
      bg: '#0C1414',
      surface: '#121E1E',
      surfaceContainer: '#192929',
      primary: '#31CBB1',
      onPrimary: '#042721',
      secondary: '#5DB9FF',
      tertiary: '#F078A8',
      onSurface: '#E6F8F6',
      onSurfaceVariant: '#90B6B1',
      border: '#233838',
      moods: ['#31CBB1', '#85D45D', '#E2BA56', '#E28666', '#DF6F9A'],
    },
  },
]

export const DEFAULT_THEME_ID = 'light'

/**
 * Find theme definition by ID with graceful fallback.
 */
export function getThemeById(id) {
  const found = THEMES.find((t) => t.id === id)
  if (found) return found
  if (id === 'dark') return THEMES.find((t) => t.id === 'dark') || THEMES[0]
  return THEMES[0]
}

/**
 * Checks if a given theme ID represents a dark mode variation.
 */
export function isDarkTheme(id) {
  if (!id) return false
  if (id === 'dark') return true
  return id.endsWith('-dark')
}

/**
 * Finds the counterpart theme in the same family (light <-> dark).
 */
export function getFamilyCounterpartTheme(currentId) {
  const current = getThemeById(currentId)
  const targetMode = current.mode === 'dark' ? 'light' : 'dark'
  const match = THEMES.find((t) => t.family === current.family && t.mode === targetMode)
  return match?.id || (targetMode === 'dark' ? 'dark' : 'light')
}

/**
 * Synchronously applies theme attributes to the document root without visual flash.
 */
export function applyThemeToDOM(themeId) {
  const root = document.documentElement
  const isDark = isDarkTheme(themeId)

  // 1. Data-theme attribute (single source of truth for custom token overrides)
  root.setAttribute('data-theme', themeId)

  // 2. Dark class for Tailwind's `dark:` modifier compatibility
  if (isDark) {
    root.classList.add('dark')
    root.style.colorScheme = 'dark'
  } else {
    root.classList.remove('dark')
    root.style.colorScheme = 'light'
  }

  // 3. Meta theme-color for mobile status bar and browser chrome
  const theme = getThemeById(themeId)
  if (theme?.metaColor) {
    let metaTag = document.querySelector('meta[name="theme-color"]')
    if (!metaTag) {
      metaTag = document.createElement('meta')
      metaTag.setAttribute('name', 'theme-color')
      document.head.appendChild(metaTag)
    }
    metaTag.setAttribute('content', theme.metaColor)
  }
}
