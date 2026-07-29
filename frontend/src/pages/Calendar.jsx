import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useEntriesQuery, useFriendEntriesQuery, useFriendsQuery } from "../api/queries";
import { getLocalDate } from "../api/client";
import BottomNav from "../components/BottomNav";
import HeaderBell from "../components/HeaderBell";
import { CalendarSkeleton } from "../components/skeleton/PageSkeletons";
import VoiceNotePlayer from "../components/VoiceNotePlayer";
import ImageWithSkeleton from "../components/ImageWithSkeleton";

const weekdays = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
const moods = {
  1: ["sentiment_very_dissatisfied", "bg-primary-container/30", "text-primary"],
  2: ["sentiment_dissatisfied", "bg-primary-container/30", "text-primary"],
  3: [
    "sentiment_neutral",
    "bg-surface-container-highest",
    "text-on-surface-variant",
  ],
  4: ["sentiment_satisfied", "bg-secondary-container/30", "text-secondary"],
  5: ["sentiment_very_satisfied", "bg-tertiary-container/30", "text-tertiary"],
};

export default function Calendar() {
  const [viewMode, setViewMode] = useState("month");
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [selectedFriendEntry, setSelectedFriendEntry] = useState(null);
  const [friendMenuOpen, setFriendMenuOpen] = useState(false);
  const [touchStart, setTouchStart] = useState(null);

  const monthKey = formatMonth(month);
  const weekEnd = addDays(weekStart, 6);
  const weekStartMonthKey = formatMonth(weekStart);
  const weekEndMonthKey = formatMonth(weekEnd);
  const isMultiMonthWeek = viewMode === "week" && weekStartMonthKey !== weekEndMonthKey;

  const friendsQuery = useFriendsQuery();

  const ownMonthEntriesQuery = useEntriesQuery(viewMode === "month" ? monthKey : weekStartMonthKey);
  const ownEndMonthEntriesQuery = useEntriesQuery(isMultiMonthWeek ? weekEndMonthKey : null, isMultiMonthWeek);

  const friendMonthEntriesQuery = useFriendEntriesQuery(
    selectedFriend?.id,
    viewMode === "month" ? monthKey : weekStartMonthKey,
    Boolean(selectedFriend)
  );
  const friendEndMonthEntriesQuery = useFriendEntriesQuery(
    selectedFriend?.id,
    weekEndMonthKey,
    Boolean(selectedFriend) && isMultiMonthWeek
  );

  const activeEntriesQuery = selectedFriend ? friendMonthEntriesQuery : ownMonthEntriesQuery;
  const activeEndEntriesQuery = selectedFriend ? friendEndMonthEntriesQuery : ownEndMonthEntriesQuery;

  const entries = useMemo(() => {
    const mainList = activeEntriesQuery.data || [];
    const secondaryList = isMultiMonthWeek ? (activeEndEntriesQuery.data || []) : [];
    return [...mainList, ...secondaryList];
  }, [activeEntriesQuery.data, activeEndEntriesQuery.data, isMultiMonthWeek]);

  const friends = friendsQuery.data || [];
  const isLoading = activeEntriesQuery.isLoading || friendsQuery.isLoading;
  const error = activeEntriesQuery.error || friendsQuery.error;

  const entriesByDate = useMemo(
    () => Object.fromEntries(entries.map((entry) => [entry.date, entry])),
    [entries],
  );

  const days = useMemo(() => {
    if (viewMode === "week") {
      return getWeekDays(weekStart).map((date) => ({ date, currentMonth: true }));
    }
    return calendarDays(month);
  }, [viewMode, weekStart, month]);

  const handleTouchStart = (e) => {
    setTouchStart({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    });
  };

  const handleTouchEnd = (e) => {
    if (!touchStart) return;
    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
    };
    const diffX = touchEnd.x - touchStart.x;
    const diffY = touchEnd.y - touchStart.y;

    if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY) * 1.2) {
      if (diffX < 0) {
        if (viewMode === "month") {
          setMonth((current) => addMonths(current, 1));
        } else {
          setWeekStart((current) => addWeeks(current, 1));
        }
      } else {
        if (viewMode === "month") {
          setMonth((current) => addMonths(current, -1));
        } else {
          setWeekStart((current) => addWeeks(current, -1));
        }
      }
    }
    setTouchStart(null);
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-background pb-28 text-on-surface">
      <header className="px-container-margin py-md">
        {selectedFriend ? (
          <div className="rounded-[24px] bg-surface-container-lowest p-md cloud-shadow">
            <button
              type="button"
              aria-expanded={friendMenuOpen}
              onClick={() => setFriendMenuOpen((open) => !open)}
              className="flex w-full items-center justify-between text-left active:scale-[0.98]"
            >
              <div className="flex items-center gap-md">
                <FriendAvatar friend={selectedFriend} size="large" />
                <span className="flex flex-col">
                  <span className="text-label-sm font-label-sm text-on-surface-variant/60">
                    Viewing calendar
                  </span>
                  <span className="text-headline-lg-mobile font-headline-lg-mobile font-bold">
                    {friendName(selectedFriend)}
                  </span>
                </span>
              </div>
              <span className="material-symbols-outlined text-primary">expand_more</span>
            </button>
            {friendMenuOpen && (
              <div className="mt-md border-t border-outline-variant pt-md">
                <button
                  type="button"
                  onClick={() => { setSelectedFriend(null); setSelectedFriendEntry(null); setFriendMenuOpen(false); }}
                  className="flex w-full items-center gap-sm rounded-xl p-2 text-left hover:bg-surface-container-low"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container text-primary">
                    <span className="material-symbols-outlined">person</span>
                  </span>
                  <span className="text-body-md font-body-md">My calendar</span>
                </button>
                {friends.map((friend) => (
                  <button
                    type="button"
                    key={friend.id}
                    onClick={() => { setSelectedFriend(friend); setSelectedFriendEntry(null); setFriendMenuOpen(false); }}
                    className="mt-xs flex w-full items-center justify-between rounded-xl p-2 text-left hover:bg-surface-container-low"
                  >
                    <span className="flex items-center gap-sm"><FriendAvatar friend={friend} /><span className="text-body-md font-body-md">{friendName(friend)}</span></span>
                    <span className="material-symbols-outlined text-on-surface-variant/20">chevron_right</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            aria-expanded={friendMenuOpen}
            onClick={() => setFriendMenuOpen((open) => !open)}
            className="flex w-full items-center justify-between rounded-[24px] bg-surface-container-lowest p-md text-left cloud-shadow active:scale-[0.98]"
          >
            <span className="text-headline-lg-mobile font-headline-lg-mobile">Your calendar</span>
            <span className="material-symbols-outlined text-primary">expand_more</span>
          </button>
        )}
        {!selectedFriend && friendMenuOpen && (
          <div className="mt-xs rounded-[24px] bg-surface-container-lowest p-md cloud-shadow">
            <p className="mb-xs text-label-sm font-label-sm text-on-surface-variant/60">Viewing calendar</p>
            {friends.length ? friends.map((friend) => (
              <button type="button" key={friend.id} onClick={() => { setSelectedFriend(friend); setSelectedFriendEntry(null); setFriendMenuOpen(false); }} className="flex w-full items-center justify-between rounded-xl p-2 text-left hover:bg-surface-container-low">
                <span className="flex items-center gap-sm"><FriendAvatar friend={friend} /><span className="text-body-md font-body-md">{friendName(friend)}</span></span>
                <span className="material-symbols-outlined text-on-surface-variant/20">chevron_right</span>
              </button>
            )) : <p className="p-2 text-body-sm font-body-sm text-on-surface-variant">Add friends to view their calendars.</p>}
          </div>
        )}
      </header>

      {isLoading ? <section className="px-container-margin pt-md"><CalendarSkeleton /></section> : <>
      <section className="mb-lg px-container-margin" aria-label="Calendar view">
        <div className="flex gap-1 rounded-full bg-surface-container-low p-1">
          <button
            type="button"
            onClick={() => {
              if (viewMode !== "week") {
                const today = new Date();
                if (month.getMonth() === today.getMonth() && month.getFullYear() === today.getFullYear()) {
                  setWeekStart(startOfWeek(today));
                } else {
                  setWeekStart(startOfWeek(month));
                }
                setViewMode("week");
              }
            }}
            className={`flex-1 rounded-full py-2 text-label-lg font-label-lg transition-all ${
              viewMode === "week"
                ? "bg-surface-container-lowest text-on-surface cloud-shadow font-bold"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Week
          </button>
          <button
            type="button"
            onClick={() => {
              if (viewMode !== "month") {
                setMonth(startOfMonth(weekStart));
                setViewMode("month");
              }
            }}
            className={`flex-1 rounded-full py-2 text-label-lg font-label-lg transition-all ${
              viewMode === "month"
                ? "bg-surface-container-lowest text-on-surface cloud-shadow font-bold"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Month
          </button>
        </div>
      </section>

      <section className="mb-md flex items-center justify-between px-container-margin">
        <button
          type="button"
          aria-label={viewMode === "month" ? "Previous month" : "Previous week"}
          onClick={() => {
            if (viewMode === "month") {
              setMonth((current) => addMonths(current, -1));
            } else {
              setWeekStart((current) => addWeeks(current, -1));
            }
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <h2 className="text-headline-lg-mobile font-headline-lg-mobile">
          {viewMode === "month"
            ? month.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })
            : formatWeekHeader(weekStart, weekEnd)}
        </h2>
        <button
          type="button"
          aria-label={viewMode === "month" ? "Next month" : "Next week"}
          onClick={() => {
            if (viewMode === "month") {
              setMonth((current) => addMonths(current, 1));
            } else {
              setWeekStart((current) => addWeeks(current, 1));
            }
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </section>

      <section
        className="px-container-margin touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="grid grid-cols-7 text-center select-none">
          {weekdays.map((day) => (
            <span
              key={day}
              className="pb-sm text-label-sm font-label-sm text-on-surface-variant/60"
            >
              {day}
            </span>
          ))}
          {days.map(({ date, currentMonth }) => {
            const dateKey = formatDate(date);
            const entry = entriesByDate[dateKey];
            const mood = entry && moods[entry.mood];
            const todayKey = getLocalDate();
            const today = dateKey === todayKey;
            const future = dateKey > todayKey;

            if (!currentMonth) {
              return (
                <span
                  key={dateKey}
                  className="flex h-[76px] items-start justify-center pt-1 text-body-md font-body-md text-on-surface-variant/20"
                >
                  {date.getDate()}
                </span>
              );
            }

            if (future) {
              return (
                <span
                  key={dateKey}
                  aria-label={`${date.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}, future date`}
                  className="flex h-[76px] flex-col items-center gap-1 text-body-md font-body-md text-on-surface-variant/30"
                >
                  <span>{date.getDate()}</span>
                  <span className="h-10 w-10 rounded-full bg-surface-container-low" />
                </span>
              );
            }

            const content = (
              <>
                <span className={`flex items-center gap-0.5 ${today ? "font-bold" : ""}`}>
                  {date.getDate()}
                  {!selectedFriend && entry?.is_hidden && (
                    <span className="material-symbols-outlined text-[13px] text-on-surface-variant/80" title="Hidden from friends">
                      lock
                    </span>
                  )}
                </span>
                <span className={`flex h-10 w-10 items-center justify-center rounded-full ${mood ? `${mood[1]} ${mood[2]} ${today ? "ring-2 ring-primary" : ""}` : "border-2 border-dashed border-outline-variant text-outline-variant"}`}>
                  <span className="material-symbols-outlined text-[20px]" style={entry ? { fontVariationSettings: "'FILL' 1" } : undefined}>{mood ? mood[0] : "add"}</span>
                </span>
              </>
            );
            if (selectedFriend) {
              if (!entry) {
                return <span key={dateKey} className="flex h-[76px] flex-col items-center gap-1 text-body-md font-body-md">{content}</span>;
              }
              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => setSelectedFriendEntry(entry)}
                  aria-label={`Read ${friendName(selectedFriend)}'s entry for ${date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`}
                  className="flex h-[76px] flex-col items-center gap-1 text-body-md font-body-md active:scale-95"
                >
                  {content}
                </button>
              );
            }
            return (
              <Link
                key={dateKey}
                to={`/entries/new?date=${dateKey}`}
                aria-label={`${entry ? "Open" : "Add"} entry for ${date.toLocaleDateString(
                  "en-US",
                  {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  },
                )}`}
                className="flex h-[76px] flex-col items-center gap-1 text-body-md font-body-md"
              >
                {content}
              </Link>
            );
          })}
        </div>
        {error && (
          <p role="alert" className="mt-md text-center text-xl font-body-sm text-error">
            {error.message}
          </p>
        )}
      </section>
      </>}

      {selectedFriendEntry && selectedFriend && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-on-surface/40 p-container-margin backdrop-blur-xs animate-in fade-in duration-200"
          role="presentation"
          onMouseDown={() => setSelectedFriendEntry(null)}
        >
          <article
            role="dialog"
            aria-modal="true"
            aria-labelledby="friend-entry-title"
            onMouseDown={(event) => event.stopPropagation()}
            className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-[24px] bg-surface-container-lowest p-lg cloud-shadow"
          >
            <div className="mb-md flex items-start justify-between gap-md">
              <div className="flex items-center gap-sm">
                <FriendAvatar friend={selectedFriend} />
                <div>
                  <p className="text-label-sm font-label-sm text-on-surface-variant">{friendName(selectedFriend)}'s day</p>
                  <h2 id="friend-entry-title" className="text-headline-lg-mobile font-headline-lg-mobile">
                    {formatEntryDate(selectedFriendEntry.date)}
                  </h2>
                </div>
              </div>
              <button type="button" aria-label="Close entry" onClick={() => setSelectedFriendEntry(null)} className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="mb-md flex items-center gap-sm">
              <span className={`flex h-12 w-12 items-center justify-center rounded-full ${moods[selectedFriendEntry.mood][1]} ${moods[selectedFriendEntry.mood][2]}`}>
                <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>{moods[selectedFriendEntry.mood][0]}</span>
              </span>
              <div className="flex flex-wrap gap-xs">
                {selectedFriendEntry.tags.map((tag) => <span key={tag} className="rounded-full bg-primary-container px-md py-xs text-label-sm font-label-sm text-primary">{tag}</span>)}
              </div>
            </div>
            <p className="whitespace-pre-wrap text-body-md font-body-md leading-6 text-on-surface">{selectedFriendEntry.text || "No note shared for this day."}</p>
            {selectedFriendEntry.photo_url && (
              <div className="mt-md">
                <ImageWithSkeleton
                  src={selectedFriendEntry.photo_url}
                  alt={`Photo from ${friendName(selectedFriend)}'s day`}
                  className="max-h-72 w-full rounded-2xl object-cover"
                  skeletonHeightClass="h-48 sm:h-64"
                />
              </div>
            )}
            {selectedFriendEntry.audio_url && <VoiceNotePlayer audioUrl={selectedFriendEntry.audio_url} duration={selectedFriendEntry.audio_duration} className="mt-md" />}
            <p className="mt-lg text-label-sm font-label-sm text-on-surface-variant/60">View only</p>
          </article>
        </div>
      )}

      <BottomNav />
    </main>
  );
}

function friendName(friend) {
  return friend.display_name || friend.username;
}

function FriendAvatar({ friend, size = "default" }) {
  const dimensions = size === "large" ? "h-12 w-12" : "h-10 w-10";
  if (friend.avatar_url) return <img src={friend.avatar_url} alt="" className={`${dimensions} rounded-full border-2 border-primary-container object-cover`} />;
  return <span className={`${dimensions} flex items-center justify-center rounded-full bg-secondary-container font-bold text-on-secondary-container`}>{friendName(friend).slice(0, 1).toUpperCase()}</span>;
}

function formatEntryDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const offset = (day + 6) % 7;
  d.setDate(d.getDate() - offset);
  return d;
}

function addWeeks(date, amount) {
  const d = new Date(date);
  d.setDate(d.getDate() + amount * 7);
  return d;
}

function addDays(date, amount) {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}

function getWeekDays(weekStart) {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

function calendarDays(month) {
  const first = startOfMonth(month);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + index,
    );
    return { date, currentMonth: date.getMonth() === month.getMonth() };
  });
}

function formatWeekHeader(start, end) {
  const startMonth = start.toLocaleDateString("en-US", { month: "short" });
  const endMonth = end.toLocaleDateString("en-US", { month: "short" });
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  if (startYear !== endYear) {
    return `${startMonth} ${start.getDate()}, ${startYear} – ${endMonth} ${end.getDate()}, ${endYear}`;
  }
  if (start.getMonth() !== end.getMonth()) {
    return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${startYear}`;
  }
  return `${startMonth} ${start.getDate()} – ${end.getDate()}, ${startYear}`;
}

function formatMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatDate(date) {
  return `${formatMonth(date)}-${String(date.getDate()).padStart(2, "0")}`;
}
