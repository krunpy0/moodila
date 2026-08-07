import { useState, useEffect, useRef } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { getLocalDate } from '../api/client'
import { useModalKeyboard } from '../hooks/useModalKeyboard'

export default function DatePickerModal({ isOpen, onClose, selectedDate, onSelectDate, maxDate = getLocalDate() }) {
  const { t, language } = useLanguage()
  const modalRef = useRef(null)

  useModalKeyboard(onClose, isOpen, modalRef)

  // Parse initial selectedDate (YYYY-MM-DD)
  const initialYear = selectedDate ? parseInt(selectedDate.slice(0, 4), 10) : new Date().getFullYear()
  const initialMonth = selectedDate ? parseInt(selectedDate.slice(5, 7), 10) - 1 : new Date().getMonth()

  const [viewYear, setViewYear] = useState(initialYear)
  const [viewMonth, setViewMonth] = useState(initialMonth)

  useEffect(() => {
    if (selectedDate) {
      setViewYear(parseInt(selectedDate.slice(0, 4), 10))
      setViewMonth(parseInt(selectedDate.slice(5, 7), 10) - 1)
    }
  }, [selectedDate, isOpen])

  if (!isOpen) return null

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDayRaw = new Date(viewYear, viewMonth, 1).getDay()
  // 0 = Mon, 6 = Sun
  const firstDayOfWeek = firstDayRaw === 0 ? 6 : firstDayRaw - 1

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    const today = new Date()
    const isCurrentOrFutureMonth = viewYear > today.getFullYear() || (viewYear === today.getFullYear() && viewMonth >= today.getMonth())
    if (isCurrentOrFutureMonth) return

    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString(
    language === 'ru' ? 'ru-RU' : 'en-US',
    { month: 'long', year: 'numeric' }
  )

  const weekDays = language === 'ru'
    ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  const handleSelectDay = (day) => {
    const mStr = String(viewMonth + 1).padStart(2, '0')
    const dStr = String(day).padStart(2, '0')
    const dateStr = `${viewYear}-${mStr}-${dStr}`

    if (dateStr <= maxDate) {
      onSelectDate(dateStr)
      onClose()
    }
  }

  const handleTodayClick = () => {
    const today = getLocalDate()
    if (today <= maxDate) {
      onSelectDate(today)
      onClose()
    }
  }

  const todayStr = getLocalDate()
  const isNextDisabled = viewYear > new Date().getFullYear() || (viewYear === new Date().getFullYear() && viewMonth >= new Date().getMonth())

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/40 p-container-margin backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[24px] bg-white p-lg cloud-shadow space-y-md text-on-surface animate-in zoom-in-95 duration-150"
      >
        {/* Header with Month Navigation */}
        <div className="flex items-center justify-between pb-xs border-b border-surface-container">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
            aria-label="Previous month"
          >
            <span className="material-symbols-outlined text-[20px]">chevron_left</span>
          </button>
          <span className="text-label-lg font-label-lg text-on-surface capitalize">
            {monthName}
          </span>
          <button
            type="button"
            onClick={handleNextMonth}
            disabled={isNextDisabled}
            className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container disabled:opacity-30 disabled:pointer-events-none transition-colors"
            aria-label="Next month"
          >
            <span className="material-symbols-outlined text-[20px]">chevron_right</span>
          </button>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold tracking-wider text-on-surface-variant/60 uppercase">
          {weekDays.map((wd) => (
            <div key={wd} className="py-1">
              {wd}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
            <div key={`empty-${idx}`} className="h-9 w-9" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const day = idx + 1
            const mStr = String(viewMonth + 1).padStart(2, '0')
            const dStr = String(day).padStart(2, '0')
            const dateStr = `${viewYear}-${mStr}-${dStr}`
            const isSelected = dateStr === selectedDate
            const isToday = dateStr === todayStr
            const isFuture = dateStr > maxDate

            return (
              <button
                key={day}
                type="button"
                disabled={isFuture}
                onClick={() => handleSelectDay(day)}
                className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-body-sm transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-primary text-on-primary font-bold shadow-md scale-105'
                    : isToday
                    ? 'border-2 border-primary text-primary font-bold hover:bg-primary-container/50'
                    : isFuture
                    ? 'text-on-surface-variant/30 cursor-not-allowed'
                    : 'text-on-surface hover:bg-surface-container-high'
                }`}
              >
                {day}
              </button>
            )
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-sm border-t border-surface-container">
          <button
            type="button"
            onClick={handleTodayClick}
            className="rounded-full bg-primary-container px-md py-1.5 text-label-sm font-label-sm text-primary hover:bg-primary-container/80 transition-colors"
          >
            {t('common.today') || (language === 'ru' ? 'Сегодня' : 'Today')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-surface-container-high px-md py-1.5 text-label-sm font-label-sm text-on-surface-variant hover:bg-surface-container-highest transition-colors"
          >
            {t('common.cancel') || (language === 'ru' ? 'Отмена' : 'Cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
