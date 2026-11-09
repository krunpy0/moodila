import { useEffect, useRef, useState } from "react";
import { useEditCommentMutation } from "../api/queries";
import { useLanguage } from "../context/LanguageContext";
import { useNotifications } from "./Notifications";

export default function CommentCard({ comment, entryId, isOwn, canAct, avatar, date, onDelete, deleting, onReport }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.text);
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);
  const textareaRef = useRef(null);
  const editMutation = useEditCommentMutation();
  const { t } = useLanguage();
  const { notify } = useNotifications();

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOutside = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  const save = (event) => {
    event.preventDefault();
    if (!draft.trim() || editMutation.isPending) return;
    editMutation.mutate({ entryId, commentId: comment.id, text: draft.trim() }, {
      onSuccess: () => setEditing(false),
      onError: (err) => notify(err.message, "error"),
    });
  };
  const menuItemClass = "flex min-h-11 w-full items-center gap-sm rounded-xl px-sm text-left text-body-sm hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40";

  return (
    <div className="flex items-start gap-sm">
      {avatar}
      <div className="min-w-0 flex-1 rounded-2xl bg-surface-container-low p-sm">
        <div className="flex items-start gap-xs">
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-sm gap-y-0.5">
            <span className="min-w-0 truncate text-label-sm font-semibold text-on-surface">
              {comment.author.display_name || comment.author.username}
            </span>
            <span className="text-label-sm text-on-surface-variant tabular-nums">{date}</span>
          </div>
          {canAct && !editing && (
            <div ref={menuRef} className="relative -mr-xs -mt-xs shrink-0">
              <button ref={menuButtonRef} type="button" aria-label={t("feed.commentActions")}
                aria-expanded={menuOpen} aria-controls={`comment-actions-${comment.id}`}
                onClick={() => setMenuOpen((open) => !open)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <span aria-hidden="true" className="material-symbols-outlined text-[20px]">more_horiz</span>
              </button>
              {menuOpen && (
                <div id={`comment-actions-${comment.id}`} className="absolute right-0 top-full z-20 w-48 max-w-[calc(100vw-5rem)] rounded-2xl bg-surface-container-high p-xs shadow-floating">
                  {isOwn ? <>
                    <button type="button" className={`${menuItemClass} text-on-surface`} onClick={() => {
                      setDraft(comment.text); setEditing(true); setMenuOpen(false);
                    }}>
                      <span aria-hidden="true" className="material-symbols-outlined text-[18px]">edit</span>{t("common.edit")}
                    </button>
                    <button type="button" className={`${menuItemClass} text-error`} disabled={deleting} onClick={() => { setMenuOpen(false); onDelete(); }}>
                      <span aria-hidden="true" className="material-symbols-outlined text-[18px]">delete</span>{t("common.delete")}
                    </button>
                  </> : <button type="button" className={`${menuItemClass} text-on-surface`} onClick={() => {
                    setMenuOpen(false);
                    onReport?.({ reportedUserId: comment.user_id, entityType: "comment", entityId: comment.id });
                  }}>
                    <span aria-hidden="true" className="material-symbols-outlined text-[18px]">flag</span>{t("profile.report")}
                  </button>}
                </div>
              )}
            </div>
          )}
        </div>
        {editing ? (
          <form onSubmit={save} className="mt-xs">
            <textarea ref={textareaRef} aria-label={t("feed.editComment")} value={draft} maxLength={500} rows={3}
              disabled={editMutation.isPending} onChange={(event) => setDraft(event.target.value)}
              className="w-full resize-y rounded-xl border border-outline-variant bg-surface p-sm text-body-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" />
            <div className="mt-xs flex flex-wrap justify-end gap-xs">
              <button type="button" disabled={editMutation.isPending} onClick={() => setEditing(false)}
                className="min-h-11 rounded-full px-sm text-label-sm text-on-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{t("common.cancel")}</button>
              <button type="submit" disabled={!draft.trim() || editMutation.isPending}
                className="min-h-11 rounded-full bg-primary px-md text-label-sm text-on-primary disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{t("common.save")}</button>
            </div>
          </form>
        ) : <p className="mt-xs whitespace-pre-wrap break-words text-body-sm text-on-surface">{comment.text}</p>}

      </div>
    </div>
  );
}
