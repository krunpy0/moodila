import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { getLocalDate } from "../api/client";
import { logout } from "../api/auth";
import {
  useEntriesQuery,
  useEntrySummaryQuery,
  useProfileQuery,
} from "../api/queries";
import BottomNav from "../components/BottomNav";
import HeaderBell from "../components/HeaderBell";
import { HomeSkeleton } from "../components/skeleton/PageSkeletons";

const moodDetails = {
  1: ["😞", "Rough", "bg-error-container/20"],
  2: ["😔", "Low", "bg-primary-container/30"],
  3: ["😐", "Okay", "bg-surface-container-highest"],
  4: ["😊", "Good", "bg-secondary-container/30"],
  5: ["😁", "Great", "bg-tertiary-container/30"],
};

export default function Home() {
  const today = useMemo(() => new Date(`${getLocalDate()}T12:00:00`), []);
  const month = formatMonth(today);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profileQuery = useProfileQuery();
  const entriesQuery = useEntriesQuery(month);
  const summaryQuery = useEntrySummaryQuery(month);

  const user = profileQuery.data?.user;
  const displayName = user?.display_name || user?.username;
  const entries = entriesQuery.data || [];
  const summary = summaryQuery.data || {
    entry_count: 0,
    dominant_mood: null,
    top_tag: null,
  };
  const isLoading = entriesQuery.isLoading || summaryQuery.isLoading;
  const error = entriesQuery.error || summaryQuery.error;

  const entriesByDate = useMemo(
    () => Object.fromEntries(entries.map((entry) => [entry.date, entry])),
    [entries],
  );
  const week = useMemo(() => weekDays(today), [today]);
  const recent = useMemo(
    () => [...entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2),
    [entries],
  );
  const dominantMood = summary.dominant_mood
    ? moodDetails[summary.dominant_mood]
    : null;

  const initials = displayName
    ? displayName
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase()
    : "";

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-background pb-32 text-on-background">
      <header className="flex items-center justify-between px-container-margin py-md">
        <div className="flex items-center gap-sm">
          <Link
            to="/profile"
            className="block shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/40"
            title="Profile"
          >
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={displayName || "Profile"}
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
            aria-label="Log out"
            title="Log out"
            onClick={async () => {
              await logout().catch(() => {});
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

      <div className="space-y-lg px-container-margin">
        {isLoading ? (
          <HomeSkeleton />
        ) : (
          <>
            <section className="relative overflow-hidden rounded-[24px] bg-primary-container p-lg cloud-shadow">
              <div className="relative z-10 flex max-w-full flex-col items-start gap-md">
                <h2 className="text-headline-lg font-headline-lg text-on-primary-container">
                  {greeting()}
                  {displayName ? `, ${displayName}` : ""}
                </h2>
                <Link
                  to="/entries/new"
                  className="flex items-center gap-xs rounded-full bg-primary px-lg py-sm text-label-lg font-label-lg text-on-primary shadow-md"
                >
                  Journal today
                  <span className="material-symbols-outlined text-[18px]">
                    edit
                  </span>
                </Link>
              </div>
            </section>

            <section className="space-y-md">
              <div className="flex items-end justify-between">
                <h2 className="text-label-lg font-label-lg text-on-surface-variant">
                  This week's mood
                </h2>
                <Link
                  to="/calendar"
                  className="text-label-sm font-label-sm text-primary"
                >
                  See more
                </Link>
              </div>
              <div className="flex justify-between gap-sm overflow-x-auto rounded-[24px] bg-white/40 p-md cloud-shadow">
                {week.map((date) => {
                  const key = formatDate(date);
                  const entry = entriesByDate[key];
                  const mood = entry && moodDetails[entry.mood];
                  const isToday = key === getLocalDate();
                  const isFuture = key > getLocalDate();
                  return (
                    <Link
                      key={key}
                      to={isFuture ? "#" : `/entries/new?date=${key}`}
                      aria-disabled={isFuture}
                      onClick={(event) => isFuture && event.preventDefault()}
                      className={`flex min-w-12 flex-col items-center gap-xs ${isFuture ? "opacity-40" : ""}`}
                    >
                      <span
                        className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl ${
                          mood ? mood[2] : "bg-surface-variant"
                        } ${isToday ? "ring-2 ring-primary" : ""}`}
                      >
                        {mood ? (
                          mood[0]
                        ) : (
                          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
                            add
                          </span>
                        )}
                      </span>
                      <span
                        className={`text-label-sm font-label-sm flex items-center gap-0.5 ${isToday ? "font-bold text-primary" : "text-on-surface-variant"}`}
                      >
                        {date.toLocaleDateString("en-US", { weekday: "short" })}
                        {entry?.is_hidden && (
                          <span
                            className="material-symbols-outlined text-[12px]"
                            title="Hidden from friends"
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

            <section
              className="grid grid-cols-2 gap-md"
              aria-labelledby="summary-title"
            >
              <div className="col-span-2 rounded-[24px] bg-surface-container-lowest p-lg cloud-shadow">
                <h2
                  id="summary-title"
                  className="text-headline-lg font-headline-lg text-on-surface"
                >
                  Mood summary
                </h2>
                <div className="mt-sm flex items-baseline gap-xs">
                  <span className="text-headline-xl font-headline-xl text-on-surface">
                    {summary.entry_count}
                  </span>
                  <span className="text-body-md font-body-md text-on-surface-variant">
                    entries
                  </span>
                </div>
                <p className="mt-1 text-body-sm font-body-sm text-on-surface-variant">
                  Total moods logged this month
                </p>
              </div>
              <div className="flex min-h-[140px] flex-col justify-between rounded-[24px] bg-primary-container/30 p-lg">
                <span className="text-label-sm font-label-sm text-on-surface-variant">
                  Dominant mood
                </span>
                <div className="flex items-center gap-xs">
                  <span className="text-[28px]">
                    {dominantMood?.[0] || "—"}
                  </span>
                  <span className="text-headline-lg font-headline-lg text-on-surface">
                    {dominantMood?.[1] || "None"}
                  </span>
                </div>
              </div>
              <div className="flex min-h-[140px] flex-col justify-between rounded-[24px] bg-secondary-container/30 p-lg">
                <span className="text-label-sm font-label-sm text-on-surface-variant">
                  Most used tag
                </span>
                <div className="flex items-center gap-xs">
                  <span className="material-symbols-outlined text-[28px] text-secondary">
                    auto_awesome
                  </span>
                  <span className="min-w-0 break-words text-headline-lg font-headline-lg text-on-surface">
                    {summary.top_tag || "None"}
                  </span>
                </div>
              </div>
            </section>

            <section className="space-y-md">
              <div className="flex items-center justify-between">
                <h2 className="text-label-lg font-label-lg uppercase text-on-surface-variant">
                  Recent logs
                </h2>
                <span className="rounded-full bg-surface-container px-sm py-xs text-label-sm font-label-sm text-on-surface-variant">
                  This month
                </span>
              </div>
              <div className="space-y-sm">
                {recent.map((entry) => {
                  const mood = moodDetails[entry.mood];
                  return (
                    <Link
                      key={entry.date}
                      to={`/entries/new?date=${entry.date}`}
                      className="flex items-center gap-md rounded-[24px] bg-white p-md cloud-shadow"
                    >
                      <span
                        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] text-[28px] ${mood[2]}`}
                      >
                        {mood[0]}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-xs">
                          <strong className="truncate text-body-md text-on-surface">
                            {entry.tags[0] || mood[1]}
                          </strong>
                          <span className="flex shrink-0 items-center gap-1 text-label-sm font-label-sm text-on-surface-variant/60">
                            {entry.is_hidden && (
                              <span
                                className="material-symbols-outlined text-[13px]"
                                title="Hidden from friends"
                              >
                                lock
                              </span>
                            )}
                            {relativeDate(entry.date)}
                          </span>
                        </span>
                        <span className="block truncate text-body-sm text-on-surface-variant">
                          {entry.text || "No note for this day."}
                        </span>
                      </span>
                    </Link>
                  );
                })}
                {!isLoading && !error && recent.length === 0 && (
                  <Link
                    to="/entries/new"
                    className="flex min-h-24 items-center justify-center rounded-[24px] bg-white p-md text-body-sm text-on-surface-variant cloud-shadow"
                  >
                    Your recent entries will appear here.
                  </Link>
                )}
              </div>
            </section>
          </>
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
      <BottomNav />
    </main>
  );
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
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

function relativeDate(date) {
  const today = getLocalDate();
  if (date === today) return "Today";
  const yesterday = new Date(`${today}T12:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date === formatDate(yesterday)) return "Yesterday";
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatDate(date) {
  return `${formatMonth(date)}-${String(date.getDate()).padStart(2, "0")}`;
}
