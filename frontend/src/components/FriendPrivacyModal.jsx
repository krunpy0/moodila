import { useRef } from "react";
import { useFriendVisibilityDefaultsQuery, useSetFriendVisibilityDefaultMutation } from "../api/queries";
import { useLanguage } from "../context/LanguageContext";
import { useModalKeyboard } from "../hooks/useModalKeyboard";
import { useNotifications } from "./Notifications";

export default function FriendPrivacyModal({ isOpen, onClose }) {
  const { t } = useLanguage();
  const { notify } = useNotifications();
  const modalRef = useRef(null);
  const { data: friends = [], isLoading, error } = useFriendVisibilityDefaultsQuery(isOpen);
  const setVisibilityMutation = useSetFriendVisibilityDefaultMutation();

  useModalKeyboard(onClose, isOpen, modalRef);

  if (!isOpen) return null;

  const handleToggle = (friend) => {
    const nextVal = !friend.hide_by_default;
    setVisibilityMutation.mutate(
      { friendId: friend.id, hideByDefault: nextVal },
      {
        onSuccess: () => {
          notify(nextVal ? t('friendPrivacy.hidden') : t('friendPrivacy.visible'));
        },
        onError: (err) => {
          notify(err.message || t('common.error'), 'error');
        },
      }
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-container-margin backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="friend-privacy-modal-title"
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[85vh] flex flex-col rounded-[24px] bg-surface-container-lowest p-lg cloud-shadow space-y-md"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-primary">
              <span className="material-symbols-outlined text-[22px]">
                visibility_off
              </span>
            </div>
            <div>
              <h2
                id="friend-privacy-modal-title"
                className="text-headline-lg-mobile font-semibold text-on-surface"
              >
                {t('friendPrivacy.title')}
              </h2>
              <p className="text-body-sm text-on-surface-variant">
                {t('friendPrivacy.subtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <p className="text-body-sm text-on-surface-variant">
          {t('friendPrivacy.description')}
        </p>

        <div className="flex-1 overflow-y-auto space-y-sm pr-1 -mr-1">
          {isLoading ? (
            <div className="py-8 text-center text-body-sm text-on-surface-variant">
              {t('common.loading')}
            </div>
          ) : error ? (
            <div className="rounded-xl bg-error-container p-sm text-body-sm text-on-error-container">
              {error.message || t('common.error')}
            </div>
          ) : friends.length === 0 ? (
            <div className="rounded-2xl bg-surface-container-low p-md text-center text-body-sm text-on-surface-variant">
              {t('friendPrivacy.noFriends')}
            </div>
          ) : (
            friends.map((friend) => {
              const isPending = setVisibilityMutation.isPending && setVisibilityMutation.variables?.friendId === friend.id;
              return (
                <div
                  key={friend.id}
                  className="flex items-center justify-between gap-sm rounded-2xl bg-surface-container-low p-sm transition-colors hover:bg-surface-container"
                >
                  <div className="flex items-center gap-sm min-w-0">
                    <Avatar user={friend} />
                    <div className="min-w-0">
                      <p className="truncate text-body-md font-semibold text-on-surface">
                        {friend.display_name || friend.username}
                      </p>
                      <p className="truncate text-label-sm text-on-surface-variant">
                        @{friend.username}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    disabled={isPending}
                    aria-checked={friend.hide_by_default}
                    aria-label={`${friend.display_name || friend.username}: ${t('friendPrivacy.hideByDefault')}`}
                    onClick={() => handleToggle(friend)}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full p-1 transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 ${
                      friend.hide_by_default ? 'bg-primary' : 'bg-surface-container-highest'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full bg-surface-container-lowest shadow-sm transition-transform duration-200 ease-in-out ${
                        friend.hide_by_default ? 'translate-x-5 text-on-primary-container' : 'translate-x-0 text-on-surface-variant'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        {friend.hide_by_default ? 'visibility_off' : 'visibility'}
                      </span>
                    </span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="pt-xs">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full bg-surface-container-high py-3 text-label-lg font-semibold text-on-surface transition-colors hover:bg-surface-container-highest"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Avatar({ user }) {
  const initials = (user.display_name || user.username || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  if (user.avatar_url) {
    return (
      <span className="inline-block h-10 w-10 shrink-0 overflow-hidden rounded-full">
        <img
          src={user.avatar_url}
          alt=""
          className="h-full w-full object-cover"
        />
      </span>
    );
  }

  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-container text-label-md font-semibold text-secondary">
      {initials}
    </span>
  );
}
