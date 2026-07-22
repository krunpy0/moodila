import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getEntriesByMonth } from "../api/entries";
import { getLocalDate } from "../api/client";
import BottomNav from "../components/BottomNav";

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
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState("Loading calendar...");
  const monthKey = formatMonth(month);

  useEffect(() => {
    setStatus("Loading calendar...");
    getEntriesByMonth(monthKey)
      .then((data) => {
        setEntries(data);
        setStatus("");
      })
      .catch((error) => setStatus(error.message));
  }, [monthKey]);

  const entriesByDate = useMemo(
    () => Object.fromEntries(entries.map((entry) => [entry.date, entry])),
    [entries],
  );
  const days = useMemo(() => calendarDays(month), [month]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-background pb-28 text-on-surface">
      <header className="flex items-center px-container-margin py-md">
        <h1 className="text-headline-lg-mobile font-headline-lg-mobile">
          Your calendar
        </h1>
      </header>

      <section className="mb-lg px-container-margin" aria-label="Calendar view">
        <div className="flex gap-1 rounded-full bg-surface-container-low p-1">
          <button
            type="button"
            disabled
            title="Week view is coming later"
            className="flex-1 rounded-full py-2 text-label-lg font-label-lg text-on-surface-variant opacity-60"
          >
            Week
          </button>
          <span className="flex-1 rounded-full bg-surface-container-lowest py-2 text-center text-label-lg font-label-lg text-on-surface cloud-shadow">
            Month
          </span>
        </div>
      </section>

      <section className="mb-md flex items-center justify-between px-container-margin">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setMonth((current) => addMonths(current, -1))}
          className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <h2 className="text-headline-lg-mobile font-headline-lg-mobile">
          {month.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </h2>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setMonth((current) => addMonths(current, 1))}
          className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant"
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </section>

      <section className="px-container-margin">
        <div className="grid grid-cols-7 text-center">
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
                <span className={today ? "font-bold" : ""}>
                  {date.getDate()}
                </span>
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    mood
                      ? `${mood[1]} ${mood[2]} ${today ? "ring-2 ring-primary" : ""}`
                      : "border-2 border-dashed border-outline-variant text-outline-variant"
                  }`}
                >
                  <span
                    className="material-symbols-outlined text-[20px]"
                    style={
                      entry ? { fontVariationSettings: "'FILL' 1" } : undefined
                    }
                  >
                    {mood ? mood[0] : "add"}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
        {status && (
          <p
            role="status"
            className={`mt-md text-center text-xl font-body-sm ${
              status === "Loading calendar..."
                ? "text-on-surface-variant"
                : "text-error"
            }`}
          >
            {status}
          </p>
        )}
      </section>

      <BottomNav />
    </main>
  );
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
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

function formatMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatDate(date) {
  return `${formatMonth(date)}-${String(date.getDate()).padStart(2, "0")}`;
}
