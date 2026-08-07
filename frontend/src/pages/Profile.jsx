import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useProfileQuery, useUpdateProfileMutation } from "../api/queries";
import { uploadEntryPhoto, deleteStorageObject } from "../api/entries";
import AppLayout from "../components/AppLayout";
import HeaderBell from "../components/HeaderBell";
import { ProfileSkeleton } from "../components/skeleton/PageSkeletons";
import { useNotifications } from "../components/Notifications";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import MoodIcon from "../components/MoodIcon";
import { getMoodInfo, getLocalizedTag } from "../utils/moods";
import ChangePasswordForm from "../components/ChangePasswordForm";
import DeleteAccountModal from "../components/DeleteAccountModal";
import AvatarCropModal from "../components/AvatarCropModal";
import VoiceNotePlayer from "../components/VoiceNotePlayer";
import ImageWithSkeleton from "../components/ImageWithSkeleton";
import { safeNavigateBack } from "../utils/navigation";

export default function Profile() {
  const navigate = useNavigate();
  const profileQuery = useProfileQuery();
  const update = useUpdateProfileMutation();
  const { notify } = useNotifications();
  const { t, formatDate } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [form, setForm] = useState(null);
  const [initialAvatarUrl, setInitialAvatarUrl] = useState("");
  const [avatarStatus, setAvatarStatus] = useState("");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const profile = profileQuery.data;
  const user = profile?.user;

  const beginEdit = () => {
    const currentAvatar = user?.avatar_url || "";
    setInitialAvatarUrl(currentAvatar);
    setForm({
      display_name: user?.display_name || "",
      avatar_url: currentAvatar,
    });
    setAvatarStatus("");
    setEditing(true);
  };

  const cancelEdit = async () => {
    const tempUrl = form?.avatar_url;
    setEditing(false);
    setAvatarStatus("");
    if (tempUrl && tempUrl !== initialAvatarUrl) {
      try {
        await deleteStorageObject(tempUrl);
      } catch (err) {
        console.warn("Could not delete temporary avatar on cancel:", err);
      }
    }
  };

  const save = (event) => {
    event.preventDefault();
    const newAvatar = form?.avatar_url || "";
    const oldAvatar = initialAvatarUrl;
    update.mutate(form, {
      onSuccess: () => {
        setEditing(false);
        setAvatarStatus("");
        notify(t("common.success"));
        if (oldAvatar && oldAvatar !== newAvatar) {
          deleteStorageObject(oldAvatar).catch((err) =>
            console.warn("Could not delete old avatar from storage:", err)
          );
        }
      },
    });
  };

  const removeAvatar = async () => {
    const currentAvatar = form?.avatar_url;
    setForm((current) => ({
      ...current,
      avatar_url: "",
    }));
    setAvatarStatus(t("profile.photoRemoved"));
    if (currentAvatar && currentAvatar !== initialAvatarUrl) {
      try {
        await deleteStorageObject(currentAvatar);
      } catch (err) {
        console.warn("Could not delete removed temp avatar:", err);
      }
    }
  };

  const selectAvatar = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      const msg = t("addEntry.maxPhotoSize");
      setAvatarStatus(msg);
      notify(msg, "error");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      const msg = t("addEntry.maxPhotoSize");
      setAvatarStatus(msg);
      notify(msg, "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleCropCancel = () => {
    setCropImageSrc(null);
  };

  const handleCropComplete = async (croppedFile) => {
    setCropImageSrc(null);
    setIsUploadingAvatar(true);
    setAvatarStatus(t("common.uploading"));
    try {
      const avatarURL = await uploadEntryPhoto(croppedFile);
      const prevTemp = form?.avatar_url;
      if (prevTemp && prevTemp !== initialAvatarUrl) {
        deleteStorageObject(prevTemp).catch((err) =>
          console.warn("Could not delete previous temporary avatar:", err)
        );
      }
      setForm((current) => ({ ...current, avatar_url: avatarURL }));
      const readyMsg = t("profile.photoReady");
      setAvatarStatus(readyMsg);
      notify(readyMsg);
    } catch (error) {
      setAvatarStatus(error.message);
      notify(error.message, "error");
    } finally {
      setIsUploadingAvatar(false);
    }
  };


  return (
    <AppLayout>
      <main className="mx-auto min-h-screen w-full max-w-md lg:max-w-5xl xl:max-w-6xl bg-background pb-32 text-on-background">
        <header className="flex items-center justify-between px-container-margin py-md">
          <button
            type="button"
            aria-label={t("common.back")}
            onClick={() => safeNavigateBack(navigate, "/home")}
            className="flex h-11 w-11 items-center justify-center rounded-full text-primary"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-headline-lg-mobile font-headline-lg-mobile text-on-surface">
            {t("profile.title")}
          </h1>
          <div className="flex items-center gap-xs">
            <HeaderBell />
            <button
              type="button"
              aria-label={t("profile.editProfile")}
              onClick={beginEdit}
              disabled={!user}
              className="flex h-11 w-11 items-center justify-center rounded-full text-primary disabled:opacity-40"
            >
              <span className="material-symbols-outlined">edit</span>
            </button>
          </div>
        </header>

        <div className="px-container-margin pt-sm">
          {profileQuery.isLoading && <ProfileSkeleton />}
          {profileQuery.error && (
            <p role="alert" className="text-center text-body-sm text-error">
              {profileQuery.error.message}
            </p>
          )}
          {user && (
            <>
              <section className="mb-8 flex flex-col items-center">
                <div className="relative mb-md">
                  <Avatar user={editing ? form : user} large />
                  {editing && (
                    <label
                      className={`absolute bottom-1 right-1 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-primary-container text-on-primary-container shadow-md transition-transform active:scale-95 ${
                        isUploadingAvatar ? "cursor-wait opacity-60" : ""
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {isUploadingAvatar ? "progress_activity" : "edit"}
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={selectAvatar}
                        disabled={isUploadingAvatar}
                        className="sr-only"
                      />
                      <span className="sr-only">
                        {t("profile.editProfile")}
                      </span>
                    </label>
                  )}
                </div>
                <h2 className="text-headline-xl font-headline-xl text-on-surface">
                  {editing
                    ? form.display_name || user.username
                    : user.display_name || user.username}
                </h2>
                <p className="text-body-md text-on-surface-variant">
                  @{user.username}
                </p>
              </section>

              {editing && (
                <form
                  onSubmit={save}
                  className="mb-8 space-y-md rounded-[24px] bg-surface-container-lowest p-lg cloud-shadow"
                >
                  <div>
                    <p className="text-label-lg text-on-surface-variant">
                      {t("addEntry.photo")}
                    </p>
                    <p className="mt-xs text-body-sm text-on-surface-variant">
                      {t("profile.photoPrompt")}
                    </p>
                    {avatarStatus && (
                      <p
                        role="status"
                        className={`mt-xs text-body-sm ${
                          avatarStatus === t("profile.photoReady")
                            ? "text-primary"
                            : avatarStatus === t("common.uploading")
                              ? "text-on-surface-variant"
                              : "text-error"
                        }`}
                      >
                        {avatarStatus}
                      </p>
                    )}
                    {form.avatar_url && (
                      <button
                        type="button"
                        onClick={removeAvatar}
                        disabled={isUploadingAvatar}
                        className="mt-sm text-label-lg text-primary disabled:opacity-50"
                      >
                        {t("common.remove")}
                      </button>
                    )}
                  </div>
                  <label className="block text-label-sm text-on-surface-variant">
                    {t("profile.displayName")}
                    <input
                      value={form.display_name}
                      maxLength={60}
                      onChange={(e) =>
                        setForm({ ...form, display_name: e.target.value })
                      }
                      className="mt-xs w-full rounded-xl bg-surface-container-low px-md py-sm text-body-md outline-none focus:ring-2 focus:ring-primary/20"
                      required
                    />
                  </label>
                  <div className="flex gap-sm pt-xs">
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={isUploadingAvatar}
                      className="flex-1 rounded-full bg-surface-container-highest py-sm text-label-lg text-on-surface-variant disabled:opacity-50"
                    >
                      {t("common.cancel")}
                    </button>
                    <button
                      type="submit"
                      disabled={update.isPending || isUploadingAvatar}
                      className="flex-1 rounded-full bg-primary py-sm text-label-lg text-on-primary disabled:opacity-50"
                    >
                      {isUploadingAvatar
                        ? t("common.uploading")
                        : update.isPending
                          ? t("common.saving")
                          : t("common.save")}
                    </button>
                  </div>
                  {update.error && (
                    <p role="alert" className="text-body-sm text-error">
                      {update.error.message}
                    </p>
                  )}
                </form>
              )}

              <section className="mb-8">
                <div className="mb-md flex items-center justify-between">
                  <h2 className="text-headline-lg font-headline-lg text-on-surface">
                    {t("profile.recentEntries")}
                  </h2>
                  <Link to="/calendar" className="text-label-lg text-primary">
                    {t("common.seeAll")}
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-md">
                  {(profile.recent_entries || []).map((entry) => {
                    const isRich = Boolean(
                      entry.audio_url ||
                        (entry.photo_url && (entry.audio_url || entry.text)) ||
                        (entry.text && entry.text.length > 80)
                    );
                    return (
                      <Link
                        key={entry.id}
                        to={`/entries/new?date=${entry.date}`}
                        className={`flex min-h-[140px] flex-col justify-between rounded-[24px] bg-surface-container-lowest p-lg cloud-shadow ${
                          isRich ? "col-span-2" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <span className="flex items-center gap-1 text-label-sm text-on-surface-variant">
                            {entry.is_hidden && (
                              <span
                                className="material-symbols-outlined text-[13px]"
                                title={t("common.hiddenFromFriends")}
                              >
                                lock
                              </span>
                            )}
                            {formatDate(entry.date)}
                          </span>
                          <span
                            className={`flex h-8 w-8 items-center justify-center rounded-full ${getMoodInfo(entry.mood, t).bg}`}
                          >
                            <MoodIcon mood={entry.mood} className="text-[20px]" />
                          </span>
                        </div>
                        {entry.photo_url && (
                          <div className="my-xs">
                            <ImageWithSkeleton
                              src={entry.photo_url}
                              alt="Entry photo"
                              className={`${isRich ? "h-36 sm:h-48" : "h-20"} w-full object-cover rounded-xl`}
                              containerClassName="rounded-xl"
                              skeletonHeightClass={isRich ? "h-36 sm:h-48" : "h-20"}
                            />
                          </div>
                        )}
                        {entry.audio_url && (
                          <div className="my-xs">
                            <VoiceNotePlayer
                              audioUrl={entry.audio_url}
                              duration={entry.audio_duration}
                            />
                          </div>
                        )}
                        <p className="line-clamp-2 text-body-sm text-on-surface">
                          {entry.text ||
                            getLocalizedTag(entry.tags?.[0], t) ||
                            t("home.noNote")}
                        </p>
                      </Link>
                    );
                  })}
                </div>
                {profile.recent_entries?.length === 0 && (
                  <p className="rounded-[24px] bg-surface-container-low p-lg text-center text-body-sm text-on-surface-variant">
                    {t("home.emptyRecent")}
                  </p>
                )}
              </section>

              <section className="mb-8 rounded-[24px] bg-surface-container-lowest p-lg cloud-shadow">
                <div className="mb-md flex items-center justify-between">
                  <h2 className="text-label-lg text-on-surface-variant">
                    {t("friends.myFriends")}
                  </h2>
                  <Link to="/friends" className="text-label-lg text-primary">
                    {t("common.manage")}
                  </Link>
                </div>
                <div className="space-y-sm">
                  {(profile.friends || []).slice(0, 5).map((friend) => (
                    <Link
                      key={friend.id}
                      to={`/profile/${friend.id}`}
                      className="flex items-center gap-sm rounded-xl p-xs transition-colors hover:bg-surface-container-low active:bg-surface-container"
                    >
                      <Avatar user={friend} />
                      <div>
                        <p className="text-body-md font-semibold text-on-surface">
                          {friend.display_name || friend.username}
                        </p>
                        <p className="text-label-sm text-on-surface-variant">
                          @{friend.username}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
                {profile.friends?.length === 0 && (
                  <p className="text-body-sm text-on-surface-variant">
                    {t("friends.noFriends")}
                  </p>
                )}
              </section>

              <section className="rounded-[24px] bg-surface-container-lowest p-lg cloud-shadow">
                <h2 className="mb-md text-label-lg text-on-surface-variant">
                  {t("profile.appSettings")}
                </h2>

                {/* Language switch */}
                <div className="flex items-center justify-between border-t border-surface-container-low py-sm">
                  <span className="flex items-center gap-sm text-body-md text-on-surface">
                    <span className="material-symbols-outlined text-on-surface-variant">
                      translate
                    </span>
                    {t("profile.language")}
                  </span>
                  <LanguageToggle />
                </div>

                {/* Theme toggle */}
                <div className="flex items-center justify-between border-t border-surface-container-low py-sm">
                  <span className="flex items-center gap-sm text-body-md text-on-surface">
                    <span className="material-symbols-outlined text-on-surface-variant">
                      palette
                    </span>
                    {t("profile.darkTheme")}
                  </span>
                  <ThemeToggle />
                </div>

                {/* Change password */}
                <div className="border-t border-surface-container-low pt-xs">
                  <button
                    type="button"
                    onClick={() => setShowChangePassword((prev) => !prev)}
                    className="flex w-full items-center justify-between py-sm text-left text-body-md font-medium text-on-surface"
                  >
                    <span className="flex items-center gap-sm">
                      <span className="material-symbols-outlined text-on-surface-variant">
                        lock
                      </span>
                      {t("profile.changePassword")}
                    </span>
                    <span className="material-symbols-outlined text-on-surface-variant">
                      {showChangePassword ? "expand_less" : "expand_more"}
                    </span>
                  </button>
                  {showChangePassword && <ChangePasswordForm />}
                </div>

                {/* Delete account */}
                <div className="border-t border-surface-container-low pt-xs">
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    className="flex w-full items-center justify-between py-sm text-left text-body-md font-medium text-error transition-opacity hover:opacity-80"
                  >
                    <span className="flex items-center gap-sm">
                      <span className="material-symbols-outlined text-error">
                        delete_forever
                      </span>
                      {t("profile.deleteAccount")}
                    </span>
                    <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
                      chevron_right
                    </span>
                  </button>
                </div>
              </section>
              <DeleteAccountModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
              />
              <AvatarCropModal
                imageSrc={cropImageSrc}
                onCropComplete={handleCropComplete}
                onCancel={handleCropCancel}
              />
            </>
          )}
        </div>
      </main>
    </AppLayout>
  );
}

function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage();
  const isRu = language === "ru";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isRu}
      aria-label="Toggle language (English / Русский)"
      onClick={toggleLanguage}
      className="flex items-center gap-1 rounded-full bg-surface-container-highest p-1 text-label-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span
        className={`rounded-full px-2.5 py-1 transition-all ${
          !isRu
            ? "bg-primary text-on-primary shadow-sm"
            : "text-on-surface-variant hover:text-on-surface"
        }`}
      >
        EN
      </span>
      <span
        className={`rounded-full px-2.5 py-1 transition-all ${
          isRu
            ? "bg-primary text-on-primary shadow-sm"
            : "text-on-surface-variant hover:text-on-surface"
        }`}
      >
        RU
      </span>
    </button>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={t("profile.darkTheme")}
      onClick={toggleTheme}
      className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full p-1 transition-colors duration-300 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        isDark ? "bg-primary" : "bg-surface-container-highest"
      }`}
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full bg-surface-container-lowest shadow-md transition-transform duration-300 ease-in-out ${
          isDark
            ? "translate-x-6 text-on-primary-container"
            : "translate-x-0 text-on-surface-variant"
        }`}
      >
        <span className="material-symbols-outlined text-[16px]">
          {isDark ? "dark_mode" : "light_mode"}
        </span>
      </span>
    </button>
  );
}

function Avatar({ user, large = false }) {
  const classes = large
    ? "h-[112px] w-[112px] text-headline-lg cloud-shadow"
    : "h-10 w-10 text-body-md";
  const initials = (user.display_name || user.username)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  if (user.avatar_url) {
    return (
      <span
        className={`inline-block ${classes} shrink-0 overflow-hidden rounded-full`}
      >
        <img
          src={user.avatar_url}
          alt=""
          className="h-full w-full object-cover"
        />
      </span>
    );
  }

  return (
    <span
      className={`flex ${classes} shrink-0 items-center justify-center rounded-full bg-secondary-container font-semibold text-secondary`}
    >
      {initials}
    </span>
  );
}
