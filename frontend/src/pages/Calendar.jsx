import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useEntriesQuery, useFriendEntriesQuery, useFriendsQuery } from "../api/queries";
import { getLocalDate } from "../api/client";
import BottomNav from "../components/BottomNav";
import HeaderBell from "../components/HeaderBell";
import { CalendarSkeleton } from "../components/skeleton/PageSkeletons";
import VoiceNotePlayer from "../components/VoiceNotePlayer";
import ImageWithSkeleton from "../components/ImageWithSkeleton";
import MoodIcon from "../components/MoodIcon";
import { getMoodInfo } from "../utils/moods";

const weekdays = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

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

      {viewMode === "month" ? (
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
              const mood = entry && getMoodInfo(entry.mood);
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
                  <span className={`flex h-10 w-10 items-center justify-center rounded-full ${mood ? `${mood.bg} ${today ? "ring-2 ring-primary" : ""}` : "border-2 border-dashed border-outline-variant text-outline-variant"}`}>
                    {entry ? (
                      <MoodIcon mood={entry.mood} className="text-[20px]" />
                    ) : (
                      <span className="material-symbols-outlined text-[20px]">add</span>
                    )}
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
      ) : (
        <section
          className="px-container-margin touch-pan-y space-y-md"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Weekly Mood Wave Sparkline */}
          <WeeklyMoodWave days={days} entriesByDate={entriesByDate} />

          {/* Weekly Day-by-Day Flow */}
          <div className="space-y-sm select-none">
            <div className="flex items-center justify-between px-1 pb-xs">
              <h3 className="text-label-lg font-bold text-on-surface flex items-center gap-1">
                <span className="material-symbols-outlined text-[18px] text-primary">view_day</span>
                Weekly Flow
              </h3>
              <span className="text-label-sm text-on-surface-variant/60">Swipe to navigate</span>
            </div>

            {days.map(({ date }) => {
              const dateKey = formatDate(date);
              const entry = entriesByDate[dateKey];
              const mood = entry && getMoodInfo(entry.mood);
              const todayKey = getLocalDate();
              const today = dateKey === todayKey;
              const future = dateKey > todayKey;
              const weekdayName = date.toLocaleDateString("en-US", { weekday: "short" });

              const cardContent = (
                <div
                  className={`group relative flex items-center justify-between rounded-[24px] p-md transition-all duration-200 ${
                    today
                      ? "bg-surface-container-lowest ring-2 ring-primary cloud-shadow"
                      : "bg-surface-container-lowest cloud-shadow hover:bg-surface-container-low/60"
                  } ${future ? "opacity-60" : ""}`}
                >
                  <div className="flex items-center gap-md flex-1 min-w-0">
                    {/* Date Box */}
                    <div
                      className={`flex flex-col items-center justify-center rounded-2xl px-3 py-2 min-w-[54px] shrink-0 transition-colors ${
                        today
                          ? "bg-primary text-on-primary font-bold cloud-shadow"
                          : "bg-surface-container-low text-on-surface"
                      }`}
                    >
                      <span className="text-[11px] font-bold uppercase tracking-wider opacity-80">
                        {weekdayName}
                      </span>
                      <span className="text-xl font-bold leading-none mt-0.5">
                        {date.getDate()}
                      </span>
                    </div>

                    {/* Mood & Entry Info */}
                    {entry ? (
                      <div className="flex items-center gap-md flex-1 min-w-0">
                        <span
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${mood.bg} ${
                            today ? "ring-2 ring-primary/40" : ""
                          }`}
                        >
                          <MoodIcon mood={entry.mood} className="text-[26px]" />
                        </span>
                        <div className="flex flex-col flex-1 min-w-0">
                          <div className="flex items-center gap-xs">
                            <span className="text-label-lg font-bold text-on-surface">
                              {mood.label}
                            </span>
                            {!selectedFriend && entry.is_hidden && (
                              <span
                                className="material-symbols-outlined text-[14px] text-on-surface-variant/70"
                                title="Hidden from friends"
                              >
                                lock
                              </span>
                            )}
                            {today && (
                              <span className="ml-auto sm:ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                                TODAY
                              </span>
                            )}
                          </div>
                          {entry.text ? (
                            <p className="text-body-sm text-on-surface-variant/90 truncate mt-0.5">
                              {entry.text}
                            </p>
                          ) : (
                            <p className="text-body-sm text-on-surface-variant/40 italic mt-0.5">
                              No text note
                            </p>
                          )}
                          {/* Badges for tags, photos, audio */}
                          {(entry.tags?.length > 0 || entry.photo_url || entry.audio_url) && (
                            <div className="flex items-center gap-xs mt-1.5 flex-wrap">
                              {entry.tags?.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-md bg-surface-container-high px-2 py-0.5 text-[11px] font-medium text-on-surface-variant"
                                >
                                  #{tag}
                                </span>
                              ))}
                              {entry.photo_url && (
                                <span className="flex items-center gap-1 rounded-md bg-surface-container-high px-2 py-0.5 text-[11px] text-on-surface-variant">
                                  <span className="material-symbols-outlined text-[13px]">image</span>
                                  <span>Photo</span>
                                </span>
                              )}
                              {entry.audio_url && (
                                <span className="flex items-center gap-1 rounded-md bg-surface-container-high px-2 py-0.5 text-[11px] text-on-surface-variant">
                                  <span className="material-symbols-outlined text-[13px]">mic</span>
                                  <span>Voice</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : future ? (
                      <div className="flex items-center gap-md flex-1 min-w-0 py-1">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant/30">
                          <span className="material-symbols-outlined text-[22px]">event</span>
                        </span>
                        <span className="text-body-sm font-medium text-on-surface-variant/40">
                          Upcoming day
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-md flex-1 min-w-0">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-outline-variant/60 text-outline-variant group-hover:border-primary group-hover:text-primary transition-colors">
                          <span className="material-symbols-outlined text-[22px]">add</span>
                        </span>
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="text-body-md font-medium text-on-surface">
                            No entry logged
                          </span>
                          <span className="text-label-sm text-on-surface-variant/60">
                            Tap to record your mood
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Action Chevron */}
                  {!future && (
                    <div className="shrink-0 ml-xs">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant group-hover:bg-primary-container group-hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-[18px]">
                          {entry ? "chevron_right" : "add"}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              );

              if (selectedFriend) {
                if (!entry) {
                  return <div key={dateKey}>{cardContent}</div>;
                }
                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => setSelectedFriendEntry(entry)}
                    className="w-full text-left active:scale-[0.99] transition-transform"
                  >
                    {cardContent}
                  </button>
                );
              }

              if (future) {
                return <div key={dateKey}>{cardContent}</div>;
              }

              return (
                <Link
                  key={dateKey}
                  to={`/entries/new?date=${dateKey}`}
                  className="block w-full active:scale-[0.99] transition-transform"
                >
                  {cardContent}
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
      )}
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
              <span className={`flex h-12 w-12 items-center justify-center rounded-full ${getMoodInfo(selectedFriendEntry.mood).bg}`}>
                <MoodIcon mood={selectedFriendEntry.mood} className="text-[26px]" />
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

function getSmoothPath(points) {
  if (!points || points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const mx = (p0.x + p1.x) / 2;
    d += ` C ${mx},${p0.y} ${mx},${p1.y} ${p1.x},${p1.y}`;
  }
  return d;
}

function WeeklyMoodWave({ days, entriesByDate }) {
  const points = [];
  let loggedCount = 0;
  let moodSum = 0;

  days.forEach(({ date }, index) => {
    const dateKey = formatDate(date);
    const entry = entriesByDate[dateKey];
    // SVG viewbox width: 320, height: 90
    const x = 24 + index * ((320 - 48) / 6);
    if (entry && entry.mood) {
      loggedCount++;
      moodSum += entry.mood;
      const y = 70 - ((entry.mood - 1) / 4) * 50;
      points.push({ x, y, mood: entry.mood, date, hasEntry: true });
    } else {
      points.push({ x, y: 70, mood: null, date, hasEntry: false });
    }
  });

  const avgMood = loggedCount > 0 ? (moodSum / loggedCount).toFixed(1) : null;
  const loggedPoints = points.filter((p) => p.hasEntry);
  const pathD = getSmoothPath(loggedPoints.length > 0 ? loggedPoints : []);

  const areaD =
    loggedPoints.length > 0
      ? `${pathD} L ${loggedPoints[loggedPoints.length - 1].x},80 L ${loggedPoints[0].x},80 Z`
      : "";

  return (
    <div className="rounded-[24px] bg-surface-container-lowest p-md cloud-shadow">
      <div className="flex items-center justify-between mb-xs">
        <div>
          <h3 className="text-label-lg font-bold text-on-surface flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-[20px]">show_chart</span>
            Weekly Mood Wave
          </h3>
          <p className="text-label-sm text-on-surface-variant/60">
            {loggedCount} of 7 days logged
          </p>
        </div>
        {avgMood ? (
          <div className="flex items-center gap-1.5 rounded-full bg-primary-container/40 px-3 py-1 text-primary">
            <span className="material-symbols-outlined text-[18px]">sentiment_very_satisfied</span>
            <span className="text-label-lg font-bold">{avgMood}</span>
            <span className="text-[11px] opacity-70">/ 5</span>
          </div>
        ) : (
          <span className="text-label-sm text-on-surface-variant/50 italic">No logs this week</span>
        )}
      </div>

      <div className="relative w-full pt-1">
        <svg viewBox="0 0 320 95" className="w-full overflow-visible">
          <defs>
            <linearGradient id="moodWaveGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--color-primary))" stopOpacity="0.25" />
              <stop offset="100%" stopColor="rgb(var(--color-primary))" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1="20" y1="20" x2="300" y2="20" stroke="currentColor" strokeDasharray="3 3" className="text-outline-variant/25" strokeWidth="1" />
          <line x1="20" y1="45" x2="300" y2="45" stroke="currentColor" strokeDasharray="3 3" className="text-outline-variant/25" strokeWidth="1" />
          <line x1="20" y1="70" x2="300" y2="70" stroke="currentColor" strokeDasharray="3 3" className="text-outline-variant/25" strokeWidth="1" />

          {/* Area Fill */}
          {loggedPoints.length > 0 && <path d={areaD} fill="url(#moodWaveGrad)" />}

          {/* Line */}
          {loggedPoints.length > 0 && (
            <path
              d={pathD}
              fill="none"
              stroke="rgb(var(--color-primary))"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Points */}
          {points.map((p, i) => (
            <g key={i}>
              {p.hasEntry ? (
                <>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="6"
                    fill="rgb(var(--color-surface-container-lowest))"
                    stroke="rgb(var(--color-primary))"
                    strokeWidth="3"
                  />
                  <circle cx={p.x} cy={p.y} r="2.5" fill="rgb(var(--color-primary))" />
                </>
              ) : (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="3.5"
                  className="fill-surface-container-high stroke-outline-variant/40"
                  strokeWidth="1.5"
                />
              )}
              <text
                x={p.x}
                y="90"
                textAnchor="middle"
                className="fill-on-surface-variant/60 text-[10px] font-medium"
              >
                {weekdays[i]}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

