import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useStatsQuery } from "../api/queries";
import AppLayout from "../components/AppLayout";
import MoodIcon from "../components/MoodIcon";
import { getMoodInfo, getLocalizedTag, getLocalizedInsightText } from "../utils/moods";
import { useLanguage } from "../context/LanguageContext";
import { StatsSkeleton } from "../components/skeleton/PageSkeletons";
import { safeNavigateBack } from "../utils/navigation";
import { getLocalDate } from "../api/client";
import "./Stats.css";

export default function Stats() {
  const [period, setPeriod] = useState("month");
  const [activeHeatmapDay, setActiveHeatmapDay] = useState(null);
  const navigate = useNavigate();
  const { t, language } = useLanguage();

  const { data: stats, isLoading, isError, error, refetch } = useStatsQuery(period);

  const moodSeries = stats?.mood_series || [];
  const heatmapData = stats?.heatmap_data || [];
  const tagCorrelation = stats?.tag_correlation || [];
  const dayOfWeekAverages = stats?.day_of_week_averages || [];
  const moodDistribution = stats?.mood_distribution || [];
  const insights = stats?.insights || [];

  const highestTag = stats?.highest_tag;
  const lowestTag = stats?.lowest_tag;

  const heroMoodLevel = stats?.overall_avg_mood ? Math.round(stats.overall_avg_mood) : 3;
  const heroMoodInfo = getMoodInfo(heroMoodLevel, t);

  const validTags = tagCorrelation.filter((item) => item.has_enough_data);
  const hasEntries = stats?.total_entries > 0;

  return (
    <AppLayout>
      <main className="stats-page text-on-surface">
        <header className="stats-header">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => safeNavigateBack(navigate, "/home")} aria-label={t("common.back")} className="stats-back">
              <span aria-hidden="true" className="material-symbols-outlined">arrow_back</span>
            </button>
            <div><h1>{t("stats.title")}</h1><p className="text-on-surface-variant text-body-sm mt-1">{t("stats.subtitle")}</p></div>
          </div>
          <div className="stats-period" role="group" aria-label={t("stats.periodLabel")}>
            {["week", "month", "year"].map((p) => <button key={p} type="button" onClick={() => { setPeriod(p); setActiveHeatmapDay(null); }} aria-pressed={period === p}>{t("stats.periods." + p)}</button>)}
          </div>
        </header>
        {isLoading ? <StatsSkeleton /> : isError ? <div role="alert" className="stats-empty">
          <p className="text-error">{error?.message || t("common.error")}</p>
          <button type="button" className="stats-link" onClick={() => refetch()}>{t("stats.retry")}</button>
        </div> : <>
          <section className="stats-dynamics" aria-labelledby="stats-dynamics-title">
            <div className="stats-section-heading">
              <h2 id="stats-dynamics-title">{t("stats.moodDynamics")}</h2>
              {hasEntries && <p className="text-body-sm text-on-surface-variant tabular-nums">{t("stats.totalEntries")}: <strong className="text-on-surface">{stats.total_entries}</strong></p>}
            </div>
            {hasEntries ? <>
              <div className="stats-average">
                <MoodIcon mood={heroMoodLevel} className="text-[24px]" />
                <span>{t("stats.avgMood")}</span>
                <strong>{Number(stats.overall_avg_mood).toLocaleString(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}<span className="text-on-surface-variant font-normal text-body-sm"> / 5</span></strong>
                <span className="text-on-surface-variant">{heroMoodInfo.label}</span>
              </div>
              <MoodLineChart series={moodSeries} t={t} />
              <p className="stats-chart-note">{t("stats.chartNote")}</p>
            </> : <div className="stats-empty">
              <p className="font-semibold">{t("stats.noData")}</p><p className="text-on-surface-variant mt-2">{t("stats.noStatsData")}</p>
              <button type="button" className="stats-link" onClick={() => navigate("/entries/new")}>{t("stats.addEntry")}</button>
            </div>}
          </section>
          {insights.length > 0 && <section className="stats-observations">
            <h2>{t("stats.insightsTitle")}</h2>
            <ul>{insights.map((insight, idx) => <li key={insight.id || idx}>{getLocalizedInsightText(insight, t)}</li>)}</ul>
          </section>}
          {hasEntries && <div className="stats-breakdown">
            <section aria-labelledby="stats-distribution-title">
              <h2 id="stats-distribution-title">{t("stats.moodDistribution")}</h2>
              <div className="stats-distribution">{[5, 4, 3, 2, 1].map((level) => {
                const dist = moodDistribution.find((d) => d.mood === level) || { count: 0, percentage: 0 };
                const moodInfo = getMoodInfo(level, t);
                return <div key={level} className="stats-distribution-row">
                  <MoodIcon mood={level} className="text-[22px]" /><span>{moodInfo.label}</span>
                  <div className="stats-bar-track" aria-hidden="true"><div style={{ width: dist.percentage + "%" }} className={"stats-bar " + moodBarColors[level]} /></div>
                  <span className="stats-distribution-value">{dist.percentage}% <span className="text-on-surface-variant">({dist.count})</span></span>
                </div>;
              })}</div>
            </section>
            <section aria-labelledby="stats-weekdays-title"><h2 id="stats-weekdays-title">{t("stats.dayOfWeekPattern")}</h2><DayOfWeekBarChart data={dayOfWeekAverages} language={language} /></section>
          </div>}
          <section className="stats-section" aria-labelledby="stats-tags-title">
            <h2 id="stats-tags-title">{t("stats.tagCorrelation")}</h2><p className="stats-note">{t("stats.tagNote")}</p>
            {(highestTag || lowestTag) && <dl className="stats-tag-extremes">
              {[[highestTag, "highestMoodTag"], [lowestTag, "lowestMoodTag"]].map(([tag, label]) => tag && <div key={label}>
                <dt>{t("stats." + label)}</dt><dd><span>#{getLocalizedTag(tag.tag, t)}</span><strong>{Number(tag.avg_mood).toFixed(1)}<span className="font-normal text-body-sm text-on-surface-variant"> / 5</span></strong></dd>
              </div>)}
            </dl>}
            <p className="stats-note mt-5">{t("stats.minTagDataNote")}</p>
            {validTags.length === 0 ? <p className="py-6 text-body-sm text-on-surface-variant">{t("stats.insufficientData")}</p> : <div className="stats-tags">{validTags.map((item) => <div key={item.tag} className="stats-tag-row">
              <span className="min-w-0 break-words">#{getLocalizedTag(item.tag, t)}</span><span className="shrink-0 tabular-nums"><strong>{Number(item.avg_mood).toFixed(1)}</strong><span className="text-on-surface-variant ml-2">({item.entry_count})</span></span>
            </div>)}</div>}
          </section>
          <section className="stats-section stats-calendar" aria-labelledby="stats-calendar-title">
            <h2 id="stats-calendar-title">{t("stats.annualHeatmap")}</h2><p className="stats-note mb-5">{t("stats.calendarNote")}</p>
            <AnnualHeatmap heatmapData={heatmapData} activeDay={activeHeatmapDay} setActiveDay={setActiveHeatmapDay} t={t} />
          </section>
        </>}
      </main>
    </AppLayout>
  );
}

const moodBarColors = { 5: "bg-mood-rad", 4: "bg-mood-good", 3: "bg-mood-meh", 2: "bg-mood-bad", 1: "bg-mood-awful" };

/* Mood Line Chart SVG Component */
function MoodLineChart({ series, t }) {
  const chartRef = useRef(null);
  const [width, setWidth] = useState(360);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    if (chartRef.current) observer.observe(chartRef.current);
    return () => observer.disconnect();
  }, []);

  if (!series || series.length === 0) {
    return null;
  }

  const plotLeft = 34;
  const plotRight = width - 18;
  const plotWidth = plotRight - plotLeft;

  const validPoints = series.map((pt, index) => {
    const x = (index / (series.length - 1 || 1)) * plotWidth + plotLeft;
    const y = pt.mood ? 170 - ((pt.mood - 1) / 4) * 140 : 170;
    return { ...pt, x, y, hasVal: pt.mood != null };
  });

  const loggedPoints = validPoints.filter((p) => p.hasVal);
  const segments = [];
  validPoints.forEach((point, index) => {
    if (!point.hasVal) return;
    if (index === 0 || !validPoints[index - 1].hasVal) segments.push([]);
    segments[segments.length - 1].push(point);
  });
  const pathD = segments.map(getSmoothPath).join(" ");

  // Smart decimation for X-axis labels to prevent overlap
  const total = validPoints.length;
  const shouldShowLabel = (i) => {
    if (total <= 7) return true;
    if (total <= 14) return i % 2 === 0 || i === total - 1;
    if (total <= 31) return i % 5 === 0 || i === total - 1;
    return i % Math.ceil(total / 6) === 0 || i === total - 1;
  };

  const isDense = total > 31;

  return (
    <div ref={chartRef} className="stats-line-chart">
      <svg viewBox={`0 0 ${width} 210`} className="w-full overflow-visible" role="img" aria-label={t("stats.moodDynamics")}>
        <title>{t("stats.moodDynamics")}</title>
        {/* Y-axis Grid lines & Level labels */}
        {[1, 2, 3, 4, 5].map((level) => {
          const y = 170 - ((level - 1) / 4) * 140;
          return (
            <g key={level}>
              <text
                x={plotLeft - 8}
                y={y + 3}
                textAnchor="end"
                className="fill-on-surface-variant text-[11px] font-semibold tabular-nums select-none"
              >
                {level}
              </text>
              <line
                x1={plotLeft}
                y1={y}
                x2={plotRight}
                y2={y}
                stroke="currentColor"
                strokeDasharray="3 3"
                className="text-outline-variant/30"
                strokeWidth="0.8"
              />
            </g>
          );
        })}

        {/* Break the curve at days without entries. */}
        {loggedPoints.length > 0 && (
          <path
            d={pathD}
            fill="none"
            stroke="rgb(var(--color-primary))"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Data points & X-axis Labels */}
        {validPoints.map((pt, i) => (
          <g key={i}>
            {pt.hasVal && (
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isDense ? "2" : "3"}
                className="fill-surface-container-lowest stroke-primary"
                strokeWidth="1.2"
              />
            )}
            {shouldShowLabel(i) && (
              <text
                x={pt.x}
                y="198"
                textAnchor="middle"
                className="fill-on-surface-variant text-[11px] font-medium tabular-nums select-none"
              >
                {pt.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      <dl className="sr-only">{loggedPoints.map((point) => <div key={point.date}><dt>{point.date}</dt><dd>{point.mood} / 5</dd></div>)}</dl>
    </div>
  );
}

/* Day-of-Week Bar Chart Component */
function DayOfWeekBarChart({ data, language }) {
  const daysRu = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];
  const daysEn = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const dayLabels = language === "ru" ? daysRu : daysEn;

  function getDayMoodColor(avg) {
    if (!avg || avg <= 0) return "bg-surface-container-high";
    if (avg >= 4.2) return "bg-mood-rad";
    if (avg >= 3.4) return "bg-mood-good";
    if (avg >= 2.6) return "bg-mood-meh";
    if (avg >= 1.8) return "bg-mood-bad";
    return "bg-mood-awful";
  }

  return (
    <div className="flex items-end justify-between gap-1 sm:gap-2 pt-3 h-48">
      {Array.from({ length: 7 }, (_, i) => i + 1).map((dow, idx) => {
        const item = data.find((d) => d.day === dow);
        const avg = item?.avg_mood || 0;
        const heightPct = avg > 0 ? (avg / 5) * 100 : 8;
        const barColor = getDayMoodColor(avg);

        return (
          <div key={dow} className="flex-1 flex flex-col items-center h-full justify-end gap-1.5">
            <span className="text-[11px] font-bold tabular-nums text-on-surface">
              {avg > 0 ? Number(avg).toFixed(1) : "—"}
            </span>
            <div className="w-full max-w-[28px] bg-surface-container-low rounded-t-xl h-32 flex items-end overflow-hidden p-0.5">
              <div
                className={`w-full rounded-t-lg transition-[height] duration-300 ease-out ${barColor}`}
                style={{ height: `${heightPct}%` }}
              />
            </div>
            <span className="text-label-sm font-semibold text-on-surface-variant mt-0.5">
              {dayLabels[idx]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* Annual Heatmap Component (Soft Editorial Mood Spectrum) */
function AnnualHeatmap({ heatmapData, activeDay, setActiveDay, t }) {
  const scrollRef = useRef(null);
  const todayRef = useRef(null);
  const hasAutoScrolledRef = useRef(false);
  const { language } = useLanguage();

  const monthsRu = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
  const monthsEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const months = language === "ru" ? monthsRu : monthsEn;

  const dayLabelsRu = ["Пн", "", "Ср", "", "Пт", "", ""];
  const dayLabelsEn = ["Mon", "", "Wed", "", "Fri", "", ""];
  const dayLabels = language === "ru" ? dayLabelsRu : dayLabelsEn;

  const weeks = useMemo(() => {
    if (!heatmapData || heatmapData.length === 0) return [];

    const result = [];
    let currentWeek = [];

    const firstDay = heatmapData[0];
    const firstDow = firstDay.day_of_week; // 1=Mon..7=Sun
    for (let i = 1; i < firstDow; i++) {
      currentWeek.push(null);
    }

    heatmapData.forEach((day) => {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        result.push(currentWeek);
        currentWeek = [];
      }
    });

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      result.push(currentWeek);
    }

    return result;
  }, [heatmapData]);

  // Compute month label positions
  const monthHeaders = useMemo(() => {
    if (!weeks.length) return [];
    const headers = [];
    let lastMonth = -1;

    weeks.forEach((week, wIdx) => {
      const validDay = week.find((d) => d !== null);
      if (!validDay) return;
      const mIdx = parseInt(validDay.date.split("-")[1], 10) - 1;
      if (mIdx !== lastMonth) {
        lastMonth = mIdx;
        headers.push({
          monthIdx: mIdx,
          weekIdx: wIdx,
          name: months[mIdx],
        });
      }
    });

    return headers.filter((header, index) => !headers[index + 1] || headers[index + 1].weekIdx - header.weekIdx >= 3);
  }, [weeks, months]);

  // Auto-scroll to today (current date) on mount/update
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !weeks.length || hasAutoScrolledRef.current) return;

    let timeoutId;
    let rafId;

    const scrollToToday = () => {
      const c = scrollRef.current;
      if (!c) return;
      if (c.clientWidth === 0) {
        timeoutId = setTimeout(scrollToToday, 50);
        return;
      }

      const todayStr = getLocalDate();

      if (todayRef.current) {
        const todayEl = todayRef.current;
        const containerRect = c.getBoundingClientRect();
        const todayRect = todayEl.getBoundingClientRect();
        const cellLeftInContent = todayRect.left - containerRect.left + c.scrollLeft;

        const stickyCol = c.querySelector(".sticky");
        const stickyWidth = stickyCol ? stickyCol.offsetWidth : 34;

        const visibleWidth = c.clientWidth - stickyWidth;
        const targetScrollLeft = cellLeftInContent - stickyWidth - visibleWidth / 2 + todayRect.width / 2;

        c.scrollLeft = Math.max(0, targetScrollLeft);
        hasAutoScrolledRef.current = true;
      } else {
        const lastDay = heatmapData[heatmapData.length - 1];
        const firstDay = heatmapData[0];
        if (lastDay && todayStr > lastDay.date) {
          c.scrollLeft = c.scrollWidth;
          hasAutoScrolledRef.current = true;
        } else if (firstDay && todayStr < firstDay.date) {
          c.scrollLeft = 0;
          hasAutoScrolledRef.current = true;
        }
      }
    };

    scrollToToday();
    rafId = requestAnimationFrame(scrollToToday);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
    };
  }, [weeks, heatmapData]);

  const moodColors = {
    1: "bg-mood-awful border-mood-awful/40",
    2: "bg-mood-bad border-mood-bad/40",
    3: "bg-mood-meh border-mood-meh/40",
    4: "bg-mood-good border-mood-good/40",
    5: "bg-mood-rad border-mood-rad/40",
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr + "T00:00:00");
      return date.toLocaleDateString(language === "ru" ? "ru-RU" : "en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  if (!heatmapData || heatmapData.length === 0) {
    return (
      <div className="py-8 text-center text-body-sm text-on-surface-variant font-medium">
        {t("stats.noData")}
      </div>
    );
  }

  return (
    <div className="space-y-md w-full">
      {/* Scrollable Heatmap Container */}
      <div
        ref={scrollRef}
        className="overflow-x-auto scrollbar-thin touch-pan-x pb-2 pt-1 relative rounded-lg"
      >
        <div
          className="grid gap-[3px] inline-grid select-none"
          style={{
            gridTemplateColumns: `auto repeat(${weeks.length}, 24px)`,
            gridTemplateRows: `auto repeat(7, 24px)`,
          }}
        >
          {/* Sticky top-left corner */}
          <div className="sticky left-0 bg-surface-container-lowest z-20 pr-2 border-r border-outline-variant/10 shadow-[2px_0_4px_rgba(0,0,0,0.03)]" />

          {/* Month Headers */}
          {monthHeaders.map((header) => (
            <div
              key={`${header.monthIdx}-${header.weekIdx}`}
              className="text-[11px] font-medium text-on-surface-variant whitespace-nowrap overflow-visible leading-none pb-1"
              style={{
                gridRow: 1,
                gridColumnStart: header.weekIdx + 2,
              }}
            >
              {header.name}
            </div>
          ))}

          {/* Sticky Day Labels */}
          {dayLabels.map((label, dIdx) => (
            <div
              key={dIdx}
              className="sticky left-0 bg-surface-container-lowest z-20 pr-2 flex items-center justify-end text-[11px] font-medium text-on-surface-variant leading-none border-r border-outline-variant/10 shadow-[2px_0_4px_rgba(0,0,0,0.03)] min-w-[24px]"
              style={{
                gridRow: dIdx + 2,
                gridColumn: 1,
              }}
            >
              {label}
            </div>
          ))}

          {/* Heatmap Grid Cells */}
          {weeks.map((week, wIdx) =>
            week.map((day, dIdx) => {
              if (!day) {
                return (
                  <div
                    key={`empty-${wIdx}-${dIdx}`}
                    style={{
                      gridRow: dIdx + 2,
                      gridColumn: wIdx + 2,
                    }}
                    className="h-6 w-6 rounded-[4px] opacity-0 pointer-events-none"
                  />
                );
              }

              const hasMood = day.mood !== null && day.mood !== undefined;
              const isSelected = activeDay?.date === day.date;
              const isToday = day.date === getLocalDate();

              return (
                <button
                  key={day.date}
                  ref={isToday ? todayRef : null}
                  type="button"
                  data-today={isToday ? "true" : undefined}
                  aria-label={`${formatDate(day.date)}: ${hasMood ? `${day.mood}/5` : t("stats.noData")}`}
                  aria-pressed={isSelected}
                  title={`${formatDate(day.date)}${isToday ? ` (${t("common.today")})` : ""}: ${hasMood ? `${day.mood}/5` : t("stats.noData")}`}
                  onClick={() => setActiveDay(day)}
                  style={{
                    gridRow: dIdx + 2,
                    gridColumn: wIdx + 2,
                  }}
                  className={`h-6 w-6 rounded-[4px] border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                    hasMood
                      ? moodColors[day.mood]
                      : "bg-surface-container-low border-outline-variant/20 dark:bg-surface-container/60 hover:border-outline-variant/60"
                  } ${
                    isSelected
                      ? "ring-2 ring-primary ring-offset-1 ring-offset-surface-container-lowest z-10"
                      : isToday
                      ? "ring-1 ring-primary/80 ring-offset-1 ring-offset-surface-container-lowest z-10"
                      : "hover:ring-1 hover:ring-primary/60"
                  }`}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Selected Day Floating Detail */}
      {activeDay && (
        <div role="status" className="flex items-center justify-between gap-2 rounded-lg bg-surface-container-low p-3 text-body-sm">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-[20px]">calendar_today</span>
            <div>
              <span className="font-semibold text-on-surface">{formatDate(activeDay.date)}</span>
              <span className="text-on-surface-variant mx-1.5">•</span>
              {activeDay.mood ? (
                <span className="font-bold text-primary tabular-nums">
                  {t(`moods.${activeDay.mood}`)} ({activeDay.mood}/5)
                </span>
              ) : (
                <span className="text-on-surface-variant">{t("stats.noData")}</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveDay(null)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
            aria-label={t("common.close")}
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* Soft Editorial Mood Spectrum Legend (Replaces GitHub Less/More) */}
      <div className="flex flex-wrap items-center justify-between gap-sm text-label-sm text-on-surface-variant pt-xs border-t border-outline-variant/15">
        <span className="font-semibold text-label-sm">{t("stats.heatmapLegend")}</span>
        <div className="flex items-center gap-2 text-label-sm">
          <span className="text-on-surface-variant font-medium">{t("stats.spectrumAwful", "Awful")}</span>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((m) => (
              <span
                key={m}
                className={`h-3 w-3 rounded-[2px] border ${moodColors[m]}`}
                title={`${m}/5`}
              />
            ))}
          </div>
          <span className="text-on-surface-variant font-medium">{t("stats.spectrumRad", "Rad")}</span>
        </div>
      </div>
    </div>
  );
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
