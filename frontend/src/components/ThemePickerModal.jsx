import { useState, useRef, useMemo } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'
import { THEMES, THEME_FAMILIES } from '../utils/themes'
import useModalKeyboard from '../hooks/useModalKeyboard'
import { haptics } from '../utils/haptics'

export default function ThemePickerModal({ isOpen, onClose }) {
  const modalRef = useRef(null)
  const { theme: currentThemeId, setTheme, isHalloweenAvailable } = useTheme()
  const { language, t } = useLanguage()
  const [filterMode, setFilterMode] = useState('all') // 'all' | 'light' | 'dark'

  useModalKeyboard(onClose, isOpen, modalRef)

  const isRu = language === 'ru'

  const availableThemes = useMemo(() => {
    if (isHalloweenAvailable) return THEMES
    return THEMES.filter((t) => t.family !== 'halloween')
  }, [isHalloweenAvailable])

  const lightCount = useMemo(() => availableThemes.filter((t) => t.mode === 'light').length, [availableThemes])
  const darkCount = useMemo(() => availableThemes.filter((t) => t.mode === 'dark').length, [availableThemes])

  const filteredThemes = useMemo(() => {
    if (filterMode === 'light') {
      return availableThemes.filter((t) => t.mode === 'light')
    }
    if (filterMode === 'dark') {
      return availableThemes.filter((t) => t.mode === 'dark')
    }
    return availableThemes
  }, [filterMode, availableThemes])

  if (!isOpen) return null

  const handleSelectTheme = (themeId) => {
    if (themeId !== currentThemeId) {
      haptics.selection()
      setTheme(themeId)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/56 p-3 sm:p-container-margin backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="theme-picker-modal-title"
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl lg:rounded-xxl bg-surface-container-lowest p-4 sm:p-6 shadow-modal border border-outline-variant/30 space-y-4 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-primary">
              <span className="material-symbols-outlined text-[22px]">
                palette
              </span>
            </div>
            <div>
              <h2
                id="theme-picker-modal-title"
                className="text-headline-lg-mobile sm:text-headline-md font-bold text-on-surface"
              >
                {t('themes.title', 'Тема оформления')}
              </h2>
              <p className="text-body-sm text-on-surface-variant">
                {t('themes.subtitle', 'Выберите цветовую палитру для дневника')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              haptics.selection()
              onClose()
            }}
            aria-label={t('common.close', 'Закрыть')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors focus-visible:outline-2 focus-visible:outline-primary cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Filter Segmented Control (All / Light / Dark) */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-container shrink-0">
          <button
            type="button"
            onClick={() => {
              haptics.selection()
              setFilterMode('all')
            }}
            className={`flex-1 py-1.5 px-2 sm:px-3 rounded-lg text-label-sm sm:text-label-md font-semibold transition-all cursor-pointer whitespace-nowrap text-center ${
              filterMode === 'all'
                ? 'bg-surface-bright text-on-surface shadow-subtle'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span>{t('themes.filterAll', 'Все')}</span>
            <span className="hidden xs:inline sm:inline text-on-surface-variant/75 text-[11px] sm:text-label-sm ml-1">({availableThemes.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              haptics.selection()
              setFilterMode('light')
            }}
            className={`flex-1 flex items-center justify-center gap-1 sm:gap-1.5 py-1.5 px-2 sm:px-3 rounded-lg text-label-sm sm:text-label-md font-semibold transition-all cursor-pointer whitespace-nowrap ${
              filterMode === 'light'
                ? 'bg-surface-bright text-on-surface shadow-subtle'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[15px] sm:text-[16px]">light_mode</span>
            <span>{t('themes.filterLight', 'Светлые')}</span>
            <span className="hidden xs:inline sm:inline text-on-surface-variant/75 text-[11px] sm:text-label-sm ml-0.5">({lightCount})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              haptics.selection()
              setFilterMode('dark')
            }}
            className={`flex-1 flex items-center justify-center gap-1 sm:gap-1.5 py-1.5 px-2 sm:px-3 rounded-lg text-label-sm sm:text-label-md font-semibold transition-all cursor-pointer whitespace-nowrap ${
              filterMode === 'dark'
                ? 'bg-surface-bright text-on-surface shadow-subtle'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[15px] sm:text-[16px]">dark_mode</span>
            <span>{t('themes.filterDark', 'Тёмные')}</span>
            <span className="hidden xs:inline sm:inline text-on-surface-variant/75 text-[11px] sm:text-label-sm ml-0.5">({darkCount})</span>
          </button>
        </div>

        {/* Theme Cards Grid */}
        <div
          role="radiogroup"
          aria-label={t('themes.title', 'Тема оформления')}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 overflow-y-auto pr-1 flex-1 min-h-0 focus:outline-none"
        >
          {filteredThemes.map((item) => {
            const isSelected = item.id === currentThemeId
            const familyInfo = THEME_FAMILIES[item.family]
            const displayName = isRu ? item.nameRu : item.nameEn
            const description = isRu ? familyInfo?.descRu : familyInfo?.descEn
            const isDark = item.mode === 'dark'

            return (
              <div
                key={item.id}
                role="radio"
                aria-checked={isSelected}
                tabIndex={0}
                onClick={() => handleSelectTheme(item.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleSelectTheme(item.id)
                  }
                }}
                className={`group relative flex flex-col rounded-2xl border p-3.5 transition-all duration-normal text-left cursor-pointer outline-none select-none ${
                  isSelected
                    ? 'border-primary bg-primary-container/20 ring-2 ring-primary/40 shadow-card'
                    : 'border-outline-variant/35 bg-surface-container-low hover:border-outline-variant/70 hover:bg-surface-container hover:shadow-subtle'
                } focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest`}
              >
                {/* Visual Palette Preview Mockup */}
                <div
                  className="w-full rounded-xl p-2.5 flex flex-col gap-2 transition-transform duration-normal group-hover:scale-[1.01]"
                  style={{
                    backgroundColor: item.colors.bg,
                    border: `1px solid ${item.colors.border}`,
                  }}
                >
                  {/* Top Bar with theme title & mini dots */}
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: item.colors.primary }}
                      />
                      <span
                        className="text-[11px] font-bold tracking-tight"
                        style={{ color: item.colors.onSurface }}
                      >
                        Moodila
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div
                        className="h-1.5 w-6 rounded-full opacity-40"
                        style={{ backgroundColor: item.colors.onSurfaceVariant }}
                      />
                    </div>
                  </div>

                  {/* Surface Card with Mood Bar & Content */}
                  <div
                    className="rounded-lg p-2 flex flex-col gap-1.5 shadow-sm"
                    style={{
                      backgroundColor: item.colors.surface,
                      border: `1px solid ${item.colors.border}`,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className="h-2 w-14 rounded-full"
                        style={{ backgroundColor: item.colors.primary }}
                      />
                      <div
                        className="h-1.5 w-8 rounded-full opacity-50"
                        style={{ backgroundColor: item.colors.onSurfaceVariant }}
                      />
                    </div>

                    {/* Mood Spectrum Dots Preview */}
                    <div className="flex items-center gap-1 py-0.5">
                      {item.colors.moods.map((color, idx) => (
                        <div
                          key={idx}
                          className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10 dark:ring-white/10"
                          style={{ backgroundColor: color }}
                          title={`Mood ${5 - idx}`}
                        />
                      ))}
                      <div className="flex-1" />
                      {/* Mini Primary CTA Pill */}
                      <div
                        className="h-3.5 px-1.5 rounded-full flex items-center justify-center text-[8px] font-bold"
                        style={{
                          backgroundColor: item.colors.primary,
                          color: item.colors.onPrimary,
                        }}
                      >
                        ✓
                      </div>
                    </div>
                  </div>

                  {/* Color Swatch Line (Canvas, Surface, Primary, Secondary, Tertiary) */}
                  <div className="flex items-center gap-1 px-0.5 pt-0.5">
                    <div
                      className="h-2 flex-1 rounded-xs border border-black/10"
                      style={{ backgroundColor: item.colors.bg }}
                      title="Background"
                    />
                    <div
                      className="h-2 flex-1 rounded-xs border border-black/10"
                      style={{ backgroundColor: item.colors.surfaceContainer }}
                      title="Surface"
                    />
                    <div
                      className="h-2 flex-1 rounded-xs"
                      style={{ backgroundColor: item.colors.primary }}
                      title="Primary"
                    />
                    <div
                      className="h-2 flex-1 rounded-xs"
                      style={{ backgroundColor: item.colors.secondary }}
                      title="Secondary"
                    />
                    <div
                      className="h-2 flex-1 rounded-xs"
                      style={{ backgroundColor: item.colors.tertiary }}
                      title="Tertiary"
                    />
                  </div>
                </div>

                {/* Theme Name, Mode Badge and Active Checkmark */}
                <div className="flex items-start justify-between gap-2 pt-1">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-body-sm font-bold text-on-surface">
                        {displayName}
                      </span>
                      <span
                        className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${
                          isDark
                            ? 'bg-inverse-surface text-inverse-on-surface'
                            : 'bg-surface-container-high text-on-surface-variant'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[11px]">
                          {isDark ? 'dark_mode' : 'light_mode'}
                        </span>
                        {isDark
                          ? t('themes.darkBadge', 'Тёмная')
                          : t('themes.lightBadge', 'Светлая')}
                      </span>
                    </div>
                    {description && (
                      <p className="text-[12px] text-on-surface-variant line-clamp-2 mt-0.5 leading-snug">
                        {description}
                      </p>
                    )}
                  </div>

                  {/* Selection Indicator */}
                  <div className="shrink-0 pt-0.5">
                    {isSelected ? (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-on-primary shadow-subtle">
                        <span className="material-symbols-outlined text-[15px] font-bold">
                          check
                        </span>
                      </div>
                    ) : (
                      <div className="h-5 w-5 rounded-full border border-outline-variant/60 group-hover:border-outline transition-colors" />
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end pt-2 border-t border-outline-variant/20 shrink-0">
          <button
            type="button"
            onClick={() => {
              haptics.selection()
              onClose()
            }}
            className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-primary text-on-primary text-label-md font-semibold hover:opacity-90 active:scale-95 transition-all shadow-subtle cursor-pointer focus-visible:outline-2 focus-visible:outline-primary"
          >
            {t('common.done', 'Готово')}
          </button>
        </div>
      </div>
    </div>
  )
}
