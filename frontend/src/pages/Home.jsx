/* Hallmark · designed-as-app · design-system: DESIGN.md · anti-slop: verified */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { getLocalDate } from "../api/client";
import {
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
import { haptics } from "../utils/haptics";

const EMPTY_ARRAY = [];

export default function Home() {
  const today = useMemo(() => new Date(`${getLocalDate()}T12:00:00`), []);
  const month = formatMonth(today);
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

  const monthEntries = entriesQuery.data || EMPTY_ARRAY;
  const secondaryEntries = isMultiMonthWeek ? secondaryEntriesQuery.data || EMPTY_ARRAY : EMPTY_ARRAY;
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
      <div className="w-full min-h-screen bg-gradient-to-b from-[#F7EDE7] via-[#FAF6F3] to-background dark:from-[#261F23] dark:via-[#1D1B1A] dark:to-background">
        <main className="mx-auto min-h-screen w-full max-w-md lg:max-w-6xl xl:max-w-7xl pb-32 lg:pb-12 text-on-background px-0 lg:px-6 py-0 lg:py-6">
          <header className="flex items-center justify-between px-container-margin py-md lg:hidden">
            <Link
              to="/profile"
              className="block shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/40"
              title={t("nav.profile")}
            >
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={displayName || t("nav.profile")}
                  className="h-11 w-11 shrink-0 rounded-full object-cover"
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
            </Link>
            <HeaderBell />
          </header>

        <div className="space-y-lg px-container-margin lg:px-0">
          {isLoading ? (
            <HomeSkeleton />
          ) : (
            <div className="space-y-lg lg:grid lg:grid-cols-12 lg:gap-8 lg:space-y-0 lg:items-start">
              {/* Left Column: Hero Greeting, Week Mood, Recent Logs */}
              <div className="lg:col-span-7 space-y-lg flex flex-col justify-between">
                {summary.entry_count === 0 && (
                  <section className="rounded-2xl bg-surface-container-lowest p-lg lg:p-8 shadow-card border border-primary/20 space-y-sm animate-in fade-in">
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
                        className="rounded-full bg-primary px-md py-xs text-label-sm font-semibold text-on-primary shadow-xs hover:opacity-90 transition-opacity"
                      >
                        {t("home.firstEntryBtn")}
                      </Link>
                      <Link
                        to="/friends"
                        className="rounded-full bg-surface-container-high px-md py-xs text-label-sm font-semibold text-on-surface-variant hover:bg-surface-container-highest transition-colors"
                      >
                        {t("feed.addFriendsBtn")}
                      </Link>
                    </div>
                  </section>
                )}

                <section className="space-y-md pt-1 pb-1">
                  <div className="space-y-xs">
                    <p className="text-headline-sm sm:text-headline-md font-medium text-on-surface-variant">
                      {greetingText()}
                      {displayName ? `, ${displayName}` : ""}
                    </p>
                    <h2 className="text-headline-xl sm:text-display-md font-bold text-on-surface tracking-tight">
                      {t("home.howIsItGoing")}
                    </h2>
                  </div>
                  <Link
                    to="/entries/new"
                    onClick={() => haptics.impact()}
                    className="group flex w-full items-center justify-between rounded-full bg-primary text-on-primary hover:bg-primary/95 p-2 pl-6 pr-2 shadow-card hover:shadow-floating transition-[transform,box-shadow,opacity] duration-normal ease-standard hover:-translate-y-0.5 active:scale-[0.99]"
                  >
                    <span className="text-body-md sm:text-body-lg font-bold">
                      {t("home.journalToday")}
                    </span>
                    <span className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full bg-on-primary/15 text-on-primary shadow-xs transition-transform duration-fast ease-standard group-hover:translate-x-0.5">
                      <span className="material-symbols-outlined text-[22px] sm:text-[24px]">
                        arrow_outward
                      </span>
                    </span>
                  </Link>
                </section>

                <section className="space-y-md">
                  <div className="flex items-end justify-between">
                    <h2 className="text-label-lg lg:text-body-lg font-bold text-on-surface-variant">
                      {t("home.thisWeekMood")}
                    </h2>
                  </div>
                  <div className="flex justify-between gap-sm overflow-x-auto rounded-xl lg:rounded-xxl bg-surface-container-lowest border border-outline-variant/20 p-md lg:p-6 shadow-card">
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
                          onClick={(event) => {
                            if (isFuture) {
                              event.preventDefault();
                              return;
                            }
                            haptics.selection();
                          }}
                          className={`flex min-w-12 lg:min-w-16 flex-1 flex-col items-center gap-xs lg:gap-sm transition-transform duration-fast ease-out hover:-translate-y-0.5 ${isFuture ? "opacity-40" : ""}`}
                        >
                          <span
                            className={`flex h-12 w-12 lg:h-16 lg:w-16 items-center justify-center rounded-full ${
                              mood ? mood.bg : "bg-surface-container-high"
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
                            className={`text-label-sm lg:text-body-md flex items-center gap-0.5 ${isToday ? "font-bold text-primary" : "text-on-surface-variant"}`}
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
                    <h2 className="text-headline-sm font-bold text-on-surface">
                      {t("home.recentLogs")}
                    </h2>
                    <span className="rounded-full bg-surface-container px-sm py-xs lg:px-md lg:py-sm text-label-sm text-on-surface-variant font-medium">
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
                          className="flex items-center gap-md lg:gap-lg rounded-xl lg:rounded-2xl bg-surface-container-lowest border border-outline-variant/20 p-md lg:p-5 shadow-card hover:shadow-floating hover:border-outline-variant/40 transition-[box-shadow,border-color] duration-normal ease-standard"
                        >
                          <span
                            className={`flex h-12 w-12 lg:h-14 lg:w-14 shrink-0 items-center justify-center rounded-lg ${mood.bg}`}
                          >
                            <MoodIcon mood={entry.mood} className="text-[28px] lg:text-[34px]" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start justify-between gap-xs">
                              <strong className="truncate text-body-md lg:text-headline-sm text-on-surface font-bold">
                                {getLocalizedTag(entry.tags[0], t) || mood.label}
                              </strong>
                              <span className="flex shrink-0 items-center gap-1 text-label-sm text-on-surface-variant/70">
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
                            <span className="block truncate text-body-sm text-on-surface-variant mt-0.5">
                              {entry.text || t("home.noNote")}
                            </span>
                          </span>
                        </Link>
                      );
                    })}
                    {!isLoading && !error && recent.length === 0 && (
                      <Link
                        to="/entries/new"
                        className="flex min-h-24 lg:min-h-28 items-center justify-center rounded-xl lg:rounded-2xl bg-surface-container-lowest p-md lg:p-6 text-body-sm lg:text-body-md text-on-surface-variant shadow-card border border-outline-variant/15 hover:border-outline-variant/30 transition-colors"
                      >
                        {t("home.emptyRecent")}
                      </Link>
                    )}
                  </div>
                </section>
              </div>

              {/* Right Column: Mood Summary Stats & Analytics Link */}
              <div className="lg:col-span-5 space-y-lg flex flex-col justify-between">
                <section
                  className="space-y-md lg:space-y-lg"
                  aria-labelledby="summary-title"
                >
                  {/* Monthly Summary Primary Card */}
                  <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/20 p-lg lg:p-7 shadow-card flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <h2
                          id="summary-title"
                          className="text-headline-md font-bold text-on-surface"
                        >
                          {t("home.moodSummary")}
                        </h2>
                        <span className="rounded-full bg-surface-container px-sm py-0.5 text-label-sm font-medium text-on-surface-variant">
                          {t("home.thisMonth")}
                        </span>
                      </div>
                      <p className="mt-1 text-body-sm text-on-surface-variant">
                        {t("home.totalLoggedMonth")}
                      </p>
                    </div>
                    <div className="mt-md lg:mt-lg flex items-baseline gap-xs">
                      <span className="text-display-lg font-bold text-on-surface leading-none">
                        {summary.entry_count}
                      </span>
                      <span className="text-body-md text-on-surface-variant font-medium">
                        {t("home.entries")}
                      </span>
                    </div>

                    {/* Integrated Analytics Navigation Link */}
                    <div className="mt-lg pt-md border-t border-outline-variant/15">
                      <Link
                        to="/stats"
                        onClick={() => haptics.selection()}
                        className="group flex items-center justify-between text-body-sm font-semibold text-primary hover:text-primary/80 transition-colors duration-fast"
                      >
                        <span className="flex items-center gap-xs">
                          <span className="material-symbols-outlined text-[18px]">
                            insights
                          </span>
                          {t("home.viewDetailedStats")}
                        </span>
                        <span className="material-symbols-outlined text-[18px] transition-transform duration-fast group-hover:translate-x-1">
                          arrow_forward
                        </span>
                      </Link>
                    </div>
                  </div>

                  {/* Dominant Mood and Most Used Tag Subgrid */}
                  <div className="grid grid-cols-2 gap-md lg:gap-lg">
                    {/* Dominant Mood Tile */}
                    <div className="flex min-h-[140px] lg:min-h-[180px] flex-col justify-between rounded-xl lg:rounded-xxl bg-primary-container/30 border border-outline-variant/20 p-lg lg:p-8 shadow-card">
                      <span className="text-label-sm lg:text-body-sm font-medium text-on-surface-variant">
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

                    {/* Most Used Tag Tile */}
                    <div className="flex min-h-[140px] lg:min-h-[180px] flex-col justify-between rounded-xl lg:rounded-xxl bg-secondary-container/30 border border-outline-variant/20 p-lg lg:p-8 shadow-card">
                      <span className="text-label-sm lg:text-body-sm font-medium text-on-surface-variant">
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
                  </div>
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
    </div>
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
