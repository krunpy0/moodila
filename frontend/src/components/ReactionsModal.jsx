import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useEntryReactionsQuery } from '../api/queries'
import { useLanguage } from '../context/LanguageContext'
import ReactionIcon from './ReactionIcon'
import { useModalKeyboard } from '../hooks/useModalKeyboard'

export default function ReactionsModal({ entryId, isOpen, onClose }) {
  const { data: reactors = [], isLoading, isError } = useEntryReactionsQuery(entryId, isOpen)
  const { t } = useLanguage()
  const [selectedEmoji, setSelectedEmoji] = useState('ALL')
  const modalRef = useRef(null)

  useModalKeyboard(onClose, isOpen, modalRef)

  if (!isOpen) return null

  // Unique emojis from reactions list
  const emojiCounts = reactors.reduce((acc, r) => {
    acc[r.reaction] = (acc[r.reaction] || 0) + 1
    return acc
  }, {})

  const availableEmojis = Object.keys(emojiCounts)

  const filteredReactors =
    selectedEmoji === 'ALL'
      ? reactors
      : reactors.filter((r) => r.reaction === selectedEmoji)

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('reactions.title')}
        className="relative w-full max-w-md max-h-[80vh] flex flex-col rounded-[24px] bg-surface-container-lowest cloud-shadow border border-outline-variant/15 overflow-hidden transition-all animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant/15 px-lg py-md">
          <div className="flex items-center gap-xs">
            <span className="material-symbols-outlined text-primary text-[22px]">
              favorite
            </span>
            <h3 className="text-body-md font-semibold text-on-surface">
              {t('reactions.title')}
            </h3>
            <span className="rounded-full bg-primary-container px-2 py-0.5 text-label-sm font-semibold text-on-primary-container">
              {reactors.length}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Emoji Filter Tabs */}
        {availableEmojis.length > 0 && (
          <div className="flex items-center gap-xs px-lg py-xs overflow-x-auto border-b border-outline-variant/15 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedEmoji('ALL')}
              className={`flex items-center gap-xs rounded-full px-sm py-1 text-label-sm font-semibold transition-colors shrink-0 ${
                selectedEmoji === 'ALL'
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <span>{t('reactions.all')}</span>
              <span className="text-[11px] opacity-80">{reactors.length}</span>
            </button>
            {availableEmojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setSelectedEmoji(emoji)}
                className={`flex items-center gap-xs rounded-full px-sm py-1 text-label-sm font-semibold transition-colors shrink-0 ${
                  selectedEmoji === emoji
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                <ReactionIcon reaction={emoji} className="text-[16px]" />
                <span className="text-[11px] opacity-80">
                  {emojiCounts[emoji]}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* User List */}
        <div className="flex-1 overflow-y-auto p-md space-y-xs">
          {isLoading ? (
            <div className="py-lg text-center text-body-sm text-on-surface-variant">
              {t('common.loading')}
            </div>
          ) : isError ? (
            <div className="py-lg text-center text-body-sm text-error">
              {t('common.error')}
            </div>
          ) : filteredReactors.length === 0 ? (
            <div className="py-lg text-center text-body-sm text-on-surface-variant/70">
              {t('reactions.empty')}
            </div>
          ) : (
            filteredReactors.map((item, idx) => {
              const name = item.display_name || item.username
              return (
                <div
                  key={`${item.user_id}-${item.reaction}-${idx}`}
                  className="flex items-center justify-between p-sm rounded-2xl bg-surface-container-lowest hover:bg-surface-container-low transition-colors"
                >
                  <Link
                    to={`/calendar?friend=${item.user_id}`}
                    onClick={onClose}
                    className="flex items-center gap-sm min-w-0 flex-1 group"
                  >
                    {item.avatar_url ? (
                      <img
                        src={item.avatar_url}
                        alt={name}
                        className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-primary/20"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-container font-semibold text-secondary text-body-sm">
                        {name[0].toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-body-sm font-semibold text-on-surface group-hover:text-primary transition-colors truncate">
                        {name}
                      </p>
                      <p className="text-label-sm text-on-surface-variant truncate">
                        @{item.username}
                      </p>
                    </div>
                  </Link>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container-high shadow-xs">
                    <ReactionIcon reaction={item.reaction} className="text-[18px]" />
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
