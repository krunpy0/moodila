/* Hallmark · designed-as-app · design-system: DESIGN.md */
import { useRef } from "react";
import { useLanguage } from "../context/LanguageContext";
import { useModalKeyboard } from "../hooks/useModalKeyboard";
import { haptics } from "../utils/haptics";

export default function LogoutModal({ isOpen, onClose, onConfirm, isPending }) {
  const { t } = useLanguage();
  const modalRef = useRef(null);

  const handleClose = () => {
    if (isPending) return;
    haptics.selection();
    onClose();
  };

  useModalKeyboard(handleClose, isOpen, modalRef);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/56 p-container-margin backdrop-blur-sm animate-fade-in"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-modal-title"
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-surface-container-lowest p-6 shadow-modal border border-outline-variant/30 space-y-4 animate-scale-up"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error-container text-on-error-container mx-auto">
          <span className="material-symbols-outlined text-[24px]">
            logout
          </span>
        </div>
        <div className="text-center space-y-1">
          <h2
            id="logout-modal-title"
            className="text-title-lg font-bold text-on-surface"
          >
            {t("profile.logoutConfirmTitle")}
          </h2>
          <p className="text-body-sm text-on-surface-variant">
            {t("profile.logoutConfirmDesc")}
          </p>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            disabled={isPending}
            onClick={handleClose}
            className="flex-1 rounded-full bg-surface-container-high py-3 text-label-lg font-bold text-on-surface hover:bg-surface-container-highest transition-colors duration-fast disabled:opacity-disabled"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            className="flex-1 rounded-full bg-error py-3 text-label-lg font-bold text-on-error shadow-card hover:opacity-95 transition-opacity duration-fast disabled:opacity-disabled"
          >
            {isPending ? t("common.saving") : t("common.logout")}
          </button>
        </div>
      </div>
    </div>
  );
}
