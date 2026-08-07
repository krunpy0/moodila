import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { getLocalDate } from "../api/client";
import { logout } from "../api/auth";
import {
  queryKeys,
  useEntriesQuery,
  useEntrySummaryQuery,
  useProfileQuery,
} from "../api/queries";
import AppLayout from "../components/AppLayout";
import HeaderBell from "../components/HeaderBell";
import { HomeSkeleton } from "../components/skeleton/PageSkeletons";
import MoodIcon from "../components/MoodIcon";
import { getMoodInfo, getLocalizedTag } from "../utils/moods";
import { useLanguage } from "../context/LanguageContext";

export default function Home() {
  const today = useMemo(() => new Date(`${getLocalDate()}T12:00:00`), []);
  const month = formatMonth(today);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, dateLocale, formatDate: formatDateLocale } = useLanguage();
  const profileQuery = useProfileQuery();
  const entriesQuery = useEntriesQuery(month);
  const summaryQuery = useEntrySummaryQuery(month);

  const user = profileQuery.data?.user;
  const displayName = user?.display_name || user?.username;
  const week = useMemo(() => weekDays(today), [today]);

  const weekStartMonthKey = formatMonth(week[0]);
  const weekEndMonthKey = formatMonth(week[6]);
  const isMultiMonthWeek = weekStartMonthKey !== weekEndMonthKey;
  const otherMonthKey = weekStartMonthKey !== month ? weekStartMonthKey : weekEndMonthKey;

  const secondaryEntriesQuery = useEntriesQuery(
    isMultiMonthWeek ? otherMonthKey : null,
    isMultiMonthWeek,
  );

  const monthEntries = entriesQuery.data || [];
  const secondaryEntries = isMultiMonthWeek ? secondaryEntriesQuery.data || [] : [];
  const allEntries = useMemo(
    () => [...monthEntries, ...secondaryEntries],
    [monthEntries, secondaryEntries],
  );

  const summary = summaryQuery.data || {
    entry_count: 0,
    dominant_mood: null,
    top_tag: null,
  };
  const isLoading =
    entriesQuery.isLoading ||
    summaryQuery.isLoading ||
    (isMultiMonthWeek && secondaryEntriesQuery.isLoading);
  const error =
    entriesQuery.error ||
    summaryQuery.error ||
    (isMultiMonthWeek ? secondaryEntriesQuery.error : null);

  const entriesByDate = useMemo(
    () => Object.fromEntries(allEntries.map((entry) => [entry.date, entry])),
    [allEntries],
  );
  const recent = useMemo(
    () => [...monthEntries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3),
    [monthEntries],
  );
  const dominantMood = summary.dominant_mood
    ? getMoodInfo(summary.dominant_mood, t)
    : null;

  const initials = displayName
    ? displayName
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase()
    : "";

  function greetingText() {
    const hour = new Date().getHours();
    if (hour < 12) return t("greetings.morning");
    if (hour < 18) return t("greetings.afternoon");
    return t("greetings.evening");
  }

  function relativeDate(dateStr) {
    const todayStr = getLocalDate();
    if (dateStr === todayStr) return t("common.today");
    const yesterday = new Date(`${todayStr}T12:00:00`);
    yesterday.setDate(yesterday.getDate() - 1);
    if (dateStr === formatDate(yesterday)) return t("common.yesterday");
    return formatDateLocale(dateStr);
  }

  return (
    <AppLayout>
      <main className="mx-auto min-h-screen w-full max-w-md lg:max-w-6xl xl:max-w-7xl bg-background pb-32 lg:pb-12 text-on-background px-0 lg:px-6 py-0 lg:py-6">
        <header className="flex items-center justify-between px-container-margin py-md lg:hidden">
          <div className="flex items-center gap-sm">
            <Link
              to="/profile"
              className="block shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/40"
              title={t("nav.profile")}
            >
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={displayName || t("nav.profile")}
                  className="h-10 w-10 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-container font-semibold text-secondary text-body-md">
                  {initials || (
                    <span className="material-symbols-outlined text-[20px]">
                      person
                    </span>
                  )}
                </div>
              )}
            </Link>
            <h1 className="text-headline-lg-mobile font-headline-lg-mobile">
              Moodila
            </h1>
          </div>
          <div className="flex items-center gap-xs">
            <HeaderBell />
            <button
              type="button"
              aria-label={t("common.logout")}
              title={t("common.logout")}
              onClick={async () => {
                await logout().catch(() => {});
                queryClient.setQueryData(queryKeys.session, null);
                queryClient.removeQueries({ queryKey: queryKeys.session });
                queryClient.clear();
                navigate("/login", { replace: true });
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface-variant cloud-shadow"
            >
              <span className="material-symbols-outlined text-[20px]">
                logout
              </span>
            </button>
          </div>
        </header>

        <div className="space-y-lg px-container-margin lg:px-0">
          {isLoading ? (
            <HomeSkeleton />
          ) : (
            <div className="space-y-lg lg:grid lg:grid-cols-12 lg:gap-8 lg:space-y-0 lg:items-stretch">
              {/* Left Column: Hero Greeting, Week Mood, Recent Logs */}
              <div className="lg:col-span-7 space-y-lg flex flex-col justify-between">
                {summary.entry_count === 0 && (
                  <section className="rounded-[24px] lg:rounded-[32px] bg-white p-lg lg:p-8 cloud-shadow border border-primary/20 space-y-sm animate-in fade-in">
                    <div className="flex items-center gap-sm">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-primary">
                        <span className="material-symbols-outlined text-[24px]">waving_hand</span>
                      </span>
                      <div>
                        <h3 className="text-headline-sm font-bold text-on-surface">
                          {t("home.welcomeTitle")}
                        </h3>
                        <p className="text-body-sm text-on-surface-variant">
                          {t("home.welcomeDesc")}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-xs pt-xs">
                      <Link
                        to="/entries/new"
                        className="rounded-full bg-primary px-md py-xs text-label-sm font-semibold text-on-primary shadow-xs hover:opacity-90 transition-all"
                      >
                        {t("home.firstEntryBtn")}
                      </Link>
                      <Link
                        to="/friends"
                        className="rounded-full bg-surface-container-high px-md py-xs text-label-sm font-semibold text-on-surface-variant hover:bg-surface-container-highest transition-all"
                      >
                        {t("feed.addFriendsBtn")}
                      </Link>
                    </div>
                  </section>
                )}

                <section className="relative overflow-hidden rounded-[24px] lg:rounded-[32px] bg-primary-container p-lg lg:p-8 xl:p-10 cloud-shadow">
                  <div className="relative z-10 flex max-w-full flex-col items-start gap-md lg:gap-lg">
                    <h2 className="text-headline-lg font-headline-lg lg:text-3xl xl:text-4xl lg:leading-tight font-bold text-on-primary-container">
                      {greetingText()}
                      {displayName ? `, ${displayName}` : ""}
                    </h2>
                    <Link
                      to="/entries/new"
                      className="flex items-center gap-xs rounded-full bg-primary px-lg py-sm lg:px-8 lg:py-4 text-label-lg font-label-lg lg:text-body-lg lg:font-bold text-on-primary shadow-md hover:opacity-90 transition-all hover:scale-[1.02]"
                    >
                      {t("home.journalToday")}
                      <span className="material-symbols-outlined text-[18px] lg:text-[22px]">
                        edit
                      </span>
                    </Link>
                  </div>
                </section>

                <section className="space-y-md">
                  <div className="flex items-end justify-between">
                    <h2 className="text-label-lg font-label-lg lg:text-body-lg lg:font-bold text-on-surface-variant">
                      {t("home.thisWeekMood")}
                    </h2>
                    <Link
                      to="/stats"
                      className="flex items-center gap-1 rounded-full bg-primary-container/40 px-3 py-1 text-label-sm font-bold text-primary hover:bg-primary-container hover:scale-105 active:scale-95 transition-all cloud-shadow"
                    >
                      <span className="material-symbols-outlined text-[16px]">equalizer</span>
                      <span>{t("common.seeMore")}</span>
                      <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                    </Link>
                  </div>
                  <div className="flex justify-between gap-sm overflow-x-auto rounded-[24px] lg:rounded-[32px] bg-white/40 p-md lg:p-6 cloud-shadow">
                    {week.map((date) => {
                      const key = formatDate(date);
                      const entry = entriesByDate[key];
                      const mood = entry && getMoodInfo(entry.mood, t);
                      const isToday = key === getLocalDate();
                      const isFuture = key > getLocalDate();
                      return (
                        <Link
                          key={key}
                          to={isFuture ? "#" : `/entries/new?date=${key}`}
                          aria-disabled={isFuture}
                          onClick={(event) => isFuture && event.preventDefault()}
                          className={`flex min-w-12 lg:min-w-16 flex-1 flex-col items-center gap-xs lg:gap-sm transition-transform hover:scale-105 ${isFuture ? "opacity-40" : ""}`}
                        >
                          <span
                            className={`flex h-12 w-12 lg:h-16 lg:w-16 items-center justify-center rounded-full ${
                              mood ? mood.bg : "bg-surface-variant"
                            } ${isToday ? "ring-2 lg:ring-4 ring-primary" : ""}`}
                          >
                            {entry ? (
                              <MoodIcon mood={entry.mood} className="text-[26px] lg:text-[34px]" />
                            ) : (
                              <span className="material-symbols-outlined text-[20px] lg:text-[26px] text-on-surface-variant">
                                add
                              </span>
                            )}
                          </span>
                          <span
                            className={`text-label-sm font-label-sm lg:text-body-md flex items-center gap-0.5 ${isToday ? "font-bold text-primary" : "text-on-surface-variant"}`}
                          >
                            {date.toLocaleDateString(dateLocale, { weekday: "short" })}
                            {entry?.is_hidden && (
                              <span
                                className="material-symbols-outlined text-[12px] lg:text-[14px]"
                                title={t("common.hiddenFromFriends")}
                              >
                                lock
                              </span>
                            )}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </section>

                <section className="space-y-md flex-1 flex flex-col justify-end">
                  <div className="flex items-center justify-between">
                    <h2 className="text-label-lg font-label-lg lg:text-body-lg lg:font-bold uppercase text-on-surface-variant">
                      {t("home.recentLogs")}
                    </h2>
                    <span className="rounded-full bg-surface-container px-sm py-xs lg:px-md lg:py-sm text-label-sm font-label-sm lg:text-body-sm text-on-surface-variant font-medium">
                      {t("home.thisMonth")}
                    </span>
                  </div>
                  <div className="space-y-sm lg:space-y-md">
                    {recent.map((entry) => {
                      const mood = getMoodInfo(entry.mood, t);
                      return (
                        <Link
                          key={entry.date}
                          to={`/entries/new?date=${entry.date}`}
                          className="flex items-center gap-md lg:gap-lg rounded-[24px] lg:rounded-[28px] bg-white p-md lg:p-6 cloud-shadow hover:shadow-md transition-all hover:scale-[1.01]"
                        >
                          <span
                            className={`flex h-14 w-14 lg:h-16 lg:w-16 shrink-0 items-center justify-center rounded-[20px] lg:rounded-[24px] ${mood.bg}`}
                          >
                            <MoodIcon mood={entry.mood} className="text-[32px] lg:text-[38px]" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start justify-between gap-xs">
                              <strong className="truncate text-body-md lg:text-headline-sm text-on-surface font-bold">
                                {getLocalizedTag(entry.tags[0], t) || mood.label}
                              </strong>
                              <span className="flex shrink-0 items-center gap-1 text-label-sm font-label-sm lg:text-body-sm text-on-surface-variant/60">
                                {entry.is_hidden && (
                                  <span
                                    className="material-symbols-outlined text-[13px] lg:text-[15px]"
                                    title={t("common.hiddenFromFriends")}
                                  >
                                    lock
                                  </span>
                                )}
                                {relativeDate(entry.date)}
                              </span>
                            </span>
                            <span className="block truncate text-body-sm lg:text-body-md text-on-surface-variant mt-0.5">
                              {entry.text || t("home.noNote")}
                            </span>
                          </span>
                        </Link>
                      );
                    })}
                    {!isLoading && !error && recent.length === 0 && (
                      <Link
                        to="/entries/new"
                        className="flex min-h-24 lg:min-h-32 items-center justify-center rounded-[24px] lg:rounded-[28px] bg-white p-md lg:p-6 text-body-sm lg:text-body-md text-on-surface-variant cloud-shadow"
                      >
                        {t("home.emptyRecent")}
                      </Link>
                    )}
                  </div>
                </section>
              </div>

              {/* Right Column: Mood Summary Stats */}
              <div className="lg:col-span-5 space-y-lg flex flex-col">
                <section
                  className="grid grid-cols-2 gap-md lg:gap-lg flex-1"
                  aria-labelledby="summary-title"
                >
                  <div className="col-span-2 rounded-[24px] lg:rounded-[32px] bg-surface-container-lowest p-lg lg:p-8 cloud-shadow flex flex-col justify-between">
                    <div>
                      <h2
                        id="summary-title"
                        className="text-headline-lg font-headline-lg lg:text-2xl font-bold text-on-surface"
                      >
                        {t("home.moodSummary")}
                      </h2>
                      <p className="mt-1 text-body-sm font-body-sm lg:text-body-md text-on-surface-variant">
                        {t("home.totalLoggedMonth")}
                      </p>
                    </div>
                    <div className="mt-md lg:mt-lg flex items-baseline gap-xs">
                      <span className="text-headline-xl font-headline-xl lg:text-5xl xl:text-6xl font-bold text-on-surface leading-none">
                        {summary.entry_count}
                      </span>
                      <span className="text-body-md font-body-md lg:text-headline-sm text-on-surface-variant font-medium">
                        {t("home.entries")}
                      </span>
                    </div>
                  </div>
                  <div className="flex min-h-[140px] lg:min-h-[180px] flex-col justify-between rounded-[24px] lg:rounded-[32px] bg-primary-container/30 p-lg lg:p-8 cloud-shadow">
                    <span className="text-label-sm font-label-sm lg:text-body-sm font-medium text-on-surface-variant">
                      {t("home.dominantMood")}
                    </span>
                    <div className="flex items-center gap-xs lg:gap-sm mt-2 min-w-0">
                      {dominantMood ? (
                        <MoodIcon mood={summary.dominant_mood} className="text-[28px] sm:text-[32px] lg:text-[40px] shrink-0" />
                      ) : (
                        <span className="text-body-md text-on-surface-variant shrink-0">—</span>
                      )}
                      <span className="min-w-0 text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-on-surface leading-tight tracking-tight break-words line-clamp-2">
                        {dominantMood ? dominantMood.label : t("common.none")}
                      </span>
                    </div>
                  </div>
                  <div className="flex min-h-[140px] lg:min-h-[180px] flex-col justify-between rounded-[24px] lg:rounded-[32px] bg-secondary-container/30 p-lg lg:p-8 cloud-shadow">
                    <span className="text-label-sm font-label-sm lg:text-body-sm font-medium text-on-surface-variant">
                      {t("home.mostUsedTag")}
                    </span>
                    <div className="flex items-center gap-xs lg:gap-sm mt-2 min-w-0">
                      <span className="material-symbols-outlined text-[26px] sm:text-[28px] lg:text-[36px] text-secondary shrink-0">
                        auto_awesome
                      </span>
                      <span className="min-w-0 text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-on-surface leading-tight tracking-tight break-words line-clamp-2">
                        {summary.top_tag ? getLocalizedTag(summary.top_tag, t) : t("common.none")}
                      </span>
                    </div>
                  </div>
                  <Link
                    to="/stats"
                    className="col-span-2 flex items-center justify-between gap-md rounded-[24px] lg:rounded-[32px] bg-primary text-on-primary p-md lg:p-5 cloud-shadow hover:shadow-md hover:opacity-95 transition-all hover:scale-[1.01] active:scale-[0.98] group"
                  >
                    <div className="flex items-center gap-sm lg:gap-md">
                      <div className="flex h-10 w-10 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-full bg-white/20 text-on-primary">
                        <span className="material-symbols-outlined text-[22px] lg:text-[26px]">
                          insights
                        </span>
                      </div>
                      <span className="text-body-md font-bold lg:text-headline-sm">
                        {t("home.viewDetailedStats")}
                      </span>
                    </div>
                    <div className="flex h-9 w-9 lg:h-10 lg:w-10 shrink-0 items-center justify-center rounded-full bg-white/20 transition-transform group-hover:translate-x-1">
                      <span className="material-symbols-outlined text-[20px] lg:text-[24px]">
                        arrow_forward
                      </span>
                    </div>
                  </Link>
                </section>
              </div>
            </div>
          )}
          {error && (
            <p
              role="alert"
              className="text-center text-body-sm font-body-sm text-error"
            >
              {error.message}
            </p>
          )}
        </div>
      </main>
    </AppLayout>
  );
}

function weekDays(today) {
  const mondayOffset = (today.getDay() + 6) % 7;
  const monday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - mondayOffset,
  );
  return Array.from(
    { length: 7 },
    (_, index) =>
      new Date(
        monday.getFullYear(),
        monday.getMonth(),
        monday.getDate() + index,
      ),
  );
}

function formatMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatDate(date) {
  return `${formatMonth(date)}-${String(date.getDate()).padStart(2, "0")}`;
}
