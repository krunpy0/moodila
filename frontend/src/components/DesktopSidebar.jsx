import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { logout } from "../api/auth";
import { queryKeys, useProfileQuery } from "../api/queries";
import { useLanguage } from "../context/LanguageContext";
import HeaderBell from "./HeaderBell";

const navItems = [
  ["/home", "home", "nav.home"],
  ["/calendar", "calendar_today", "nav.calendar"],
  ["/friends", "group", "nav.friends"],
  ["/feed", "rss_feed", "nav.feed"],
  ["/profile", "person", "nav.profile"],
];

export default function DesktopSidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, language, toggleLanguage } = useLanguage();
  const profileQuery = useProfileQuery();

  const user = profileQuery.data?.user;
  const displayName = user?.display_name || user?.username || "";
  const initials = displayName
    ? displayName
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase()
    : "";

  const handleLogout = async () => {
    await logout().catch(() => {});
    queryClient.setQueryData(queryKeys.session, null);
    queryClient.removeQueries({ queryKey: queryKeys.session });
    queryClient.clear();
    navigate("/login", { replace: true });
  };

  return (
    <aside
      aria-label="Desktop Sidebar"
      className="hidden lg:flex flex-col w-72 h-screen sticky top-0 bg-surface-container-lowest cloud-shadow border-r border-outline-variant/15 p-6 z-40 shrink-0 select-none justify-between overflow-y-auto"
    >
      {/* Top Header & Branding */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link
            to="/home"
            className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-xl p-1"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl items-center bg-primary-container text-on-primary-container shadow-xs transition-transform group-hover:scale-105">
              <span className="text-[24px]">🌸</span>
            </div>
            <div>
              <span className="text-headline-lg font-bold text-on-surface tracking-tight block leading-tight">
                Moodila
              </span>
              <span className="text-label-sm text-on-surface-variant/70 font-medium block">
                {language === "ru" ? "Дневник настроения" : "Mood Journal"}
              </span>
            </div>
          </Link>
          <HeaderBell />
        </div>

        {/* User Card */}
        {user && (
          <Link
            to="/profile"
            className="flex items-center gap-3 p-3 rounded-[20px] bg-surface-container-low hover:bg-surface-container transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={displayName}
                className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-primary/20"
              />
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary-container font-semibold text-secondary text-body-md">
                {initials || (
                  <span className="material-symbols-outlined text-[22px]">
                    person
                  </span>
                )}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-body-md font-semibold text-on-surface truncate leading-tight">
                {displayName}
              </p>
              <p className="text-label-sm text-on-surface-variant truncate">
                @{user.username}
              </p>
            </div>
          </Link>
        )}

        {/* Primary CTA button */}
        <Link
          to="/entries/new"
          className="flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-full bg-primary text-on-primary font-semibold text-label-lg shadow-md hover:opacity-95 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <span className="material-symbols-outlined text-[20px]">
            add_circle
          </span>
          <span>{t("nav.addEntry")}</span>
        </Link>

        {/* Navigation Items */}
        <nav aria-label="Desktop Navigation" className="space-y-1 pt-2">
          {navItems.map(([to, icon, labelKey]) => {
            const active = pathname === to;
            const label = t(labelKey);
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-medium text-body-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  active
                    ? "bg-primary-container text-on-primary-container font-bold shadow-xs"
                    : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                }`}
              >
                <span
                  className="material-symbols-outlined text-[22px]"
                  style={
                    active ? { fontVariationSettings: "'FILL' 1" } : undefined
                  }
                >
                  {icon}
                </span>
                <span>{label}</span>
              </Link>
            );
          })}

          {user?.role === "admin" && (
            <Link
              to="/admin"
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-medium text-body-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                pathname === "/admin"
                  ? "bg-primary-container text-on-primary-container font-bold shadow-xs"
                  : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
              }`}
            >
              <span
                className="material-symbols-outlined text-[22px]"
                style={
                  pathname === "/admin"
                    ? { fontVariationSettings: "'FILL' 1" }
                    : undefined
                }
              >
                admin_panel_settings
              </span>
              <span>Admin</span>
            </Link>
          )}
        </nav>
      </div>

      {/* Bottom Footer Actions */}
      <div className="pt-6 border-t border-outline-variant/15 space-y-2">
        <div className="flex items-center justify-between px-2">
          {/* Language Switcher */}
          <button
            type="button"
            onClick={toggleLanguage}
            title={
              language === "ru" ? "Switch to English" : "Переключить на русский"
            }
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container text-label-sm font-semibold transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">
              language
            </span>
            <span>{language.toUpperCase()}</span>
          </button>

          {/* Logout button */}
          <button
            type="button"
            onClick={handleLogout}
            title={t("common.logout")}
            aria-label={t("common.logout")}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant hover:text-error hover:bg-error-container/20 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">
              logout
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}
