/* Hallmark · designed-as-app · design-system: DESIGN.md */
import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useStatsQuery } from "../api/queries";
import AppLayout from "../components/AppLayout";
import MoodIcon from "../components/MoodIcon";
import { getMoodInfo, getLocalizedTag, getLocalizedInsightText } from "../utils/moods";
import { useLanguage } from "../context/LanguageContext";
import { StatsSkeleton } from "../components/skeleton/PageSkeletons";
import { safeNavigateBack } from "../utils/navigation";

export default function Stats() {
  const [period, setPeriod] = useState("month");
  const [activeHeatmapDay, setActiveHeatmapDay] = useState(null);
  const navigate = useNavigate();
  const { t, language } = useLanguage();

  const { data: stats, isLoading, isError, error } = useStatsQuery(period);

  const moodSeries = stats?.mood_series || [];
  const heatmapData = stats?.heatmap_data || [];
  const tagCorrelation = stats?.tag_correlation || [];
  const dayOfWeekAverages = stats?.day_of_week_averages || [];
  const moodDistribution = stats?.mood_distribution || [];
  const insights = stats?.insights || [];

  const highestTag = stats?.highest_tag;
  const lowestTag = stats?.lowest_tag;

  return (
    <AppLayout>
      <main className="mx-auto min-h-screen w-full max-w-md lg:max-w-6xl xl:max-w-7xl bg-background pb-32 lg:pb-12 text-on-surface px-0 lg:px-6 py-0 lg:py-6">
        {/* Header */}
        <header className="px-container-margin py-md flex items-center justify-between">
          <div className="flex items-center gap-sm">
            <button
              type="button"
              onClick={() => safeNavigateBack(navigate, "/home")}
              aria-label={t("common.back")}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface-variant shadow-card border border-outline-variant/20 active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <div>
              <h1 className="text-headline-lg font-headline-lg lg:text-3xl font-bold">
                {t("stats.title")}
              </h1>
              <p className="text-label-sm font-label-sm text-on-surface-variant/70">
                {t("stats.subtitle")}
              </p>
            </div>
          </div>
        </header>

        {isLoading ? (
          <StatsSkeleton />
        ) : isError ? (
          <div className="px-container-margin py-8 text-center text-error">
            {error?.message || t("common.error")}
          </div>
        ) : (
          <div className="px-container-margin space-y-lg">
            {/* Algorithmic Personalized Insights Carousel/List */}
            {insights.length > 0 && (
              <section className="space-y-sm">
                <h2 className="text-label-lg font-bold text-on-surface-variant flex items-center gap-1.5 uppercase">
                  <span className="material-symbols-outlined text-[18px] text-primary">psychology</span>
                  {t("stats.insightsTitle")}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-sm">
                  {insights.map((insight, idx) => (
                    <div
                      key={insight.id || idx}
                      className="flex items-start gap-md rounded-xl bg-surface-container-lowest border border-outline-variant/20 p-md shadow-card"
                    >
                      <span className="material-symbols-outlined text-[24px] text-primary shrink-0 mt-0.5">
                        {insight.type === "positive" ? "trending_up" : insight.type === "negative" ? "trending_down" : "lightbulb"}
                      </span>
                      <div>
                        <p className="text-body-md font-medium text-on-surface leading-snug">
                          {getLocalizedInsightText(insight, t)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Line Chart & Period Switcher */}
            <section className="rounded-xl lg:rounded-xxl bg-surface-container-lowest border border-outline-variant/20 p-md lg:p-8 shadow-card space-y-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-sm">
                <div>
                  <h2 className="text-headline-sm font-bold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">show_chart</span>
                    {t("stats.moodDynamics")}
                  </h2>
                  {stats?.overall_avg_mood && (
                    <p className="text-label-sm text-on-surface-variant/70 mt-0.5 tabular-nums">
                      {t("stats.avgMood")}: <strong className="text-primary font-bold">{stats.overall_avg_mood} / 5</strong> ({stats.total_entries} {t("stats.entriesCount")})
                    </p>
                  )}
                </div>

                {/* Period Switcher */}
                <div className="flex rounded-full bg-surface-container-low p-1 self-start sm:self-auto">
                  {["week", "month", "year"].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPeriod(p)}
                      className={`px-md py-1.5 text-label-md font-label-md rounded-full transition-all ${
                        period === p
                          ? "bg-surface-container-lowest text-on-surface font-bold cloud-shadow"
                          : "text-on-surface-variant hover:text-on-surface"
                      }`}
                    >
                      {t(`stats.periods.${p}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mood Line Chart SVG */}
              <div className="pt-sm">
                <MoodLineChart series={moodSeries} period={period} language={language} />
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-md lg:gap-8">
              {/* Mood Distribution */}
              <section className="lg:col-span-6 rounded-xl lg:rounded-xxl bg-surface-container-lowest border border-outline-variant/20 p-md lg:p-8 shadow-card space-y-md">
                <h2 className="text-headline-sm font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">pie_chart</span>
                  {t("stats.moodDistribution")}
                </h2>
                <div className="space-y-sm pt-xs">
                  {[5, 4, 3, 2, 1].map((level) => {
                    const dist = moodDistribution.find((d) => d.mood === level) || {
                      count: 0,
                      percentage: 0,
                    };
                    const moodInfo = getMoodInfo(level, t);
                    const moodBarColors = {
                      5: "bg-mood-rad",
                      4: "bg-mood-good",
                      3: "bg-mood-meh",
                      2: "bg-mood-bad",
                      1: "bg-mood-awful",
                    };
                    return (
                      <div key={level} className="flex items-center gap-sm">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${moodInfo.bg}`}>
                          <MoodIcon mood={level} className="text-[20px]" />
                        </span>
                        <div className="min-w-24 text-body-sm font-medium text-on-surface truncate">
                          {moodInfo.label}
                        </div>
                        <div className="flex-1 h-3 rounded-full bg-surface-container-low overflow-hidden">
                          <div
                            className={`h-full w-full rounded-full ${moodBarColors[level] || "bg-primary"} origin-left transition-transform duration-500 ease-out`}
                            style={{ transform: `scaleX(${dist.percentage / 100})` }}
                          />
                        </div>
                        <span className="w-16 text-right text-label-sm font-bold text-on-surface-variant tabular-nums">
                          {dist.percentage}% ({dist.count})
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Day-of-Week Pattern */}
              <section className="lg:col-span-6 rounded-xl lg:rounded-xxl bg-surface-container-lowest border border-outline-variant/20 p-md lg:p-8 shadow-card space-y-md">
                <h2 className="text-headline-sm font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">calendar_view_week</span>
                  {t("stats.dayOfWeekPattern")}
                </h2>
                <DayOfWeekBarChart data={dayOfWeekAverages} language={language} />
              </section>
            </div>

            {/* Tag Correlation */}
            <section className="rounded-xl lg:rounded-xxl bg-surface-container-lowest border border-outline-variant/20 p-md lg:p-8 shadow-card space-y-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-xs">
                <h2 className="text-headline-sm font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">tag</span>
                  {t("stats.tagCorrelation")}
                </h2>
                <span className="text-label-sm text-on-surface-variant/70 italic">
                  {t("stats.minTagDataNote")}
                </span>
              </div>

              {/* Top / Bottom Tag Highlight Cards (only shown if data exists) */}
              {(highestTag || lowestTag) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                  {highestTag && (
                    <div className="flex items-center gap-md rounded-lg bg-primary-container/30 border border-outline-variant/20 p-md shadow-subtle">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary">
                        <span className="material-symbols-outlined">sentiment_very_satisfied</span>
                      </span>
                      <div>
                        <span className="text-label-sm font-medium text-on-surface-variant">
                          {t("stats.highestMoodTag")}
                        </span>
                        <p className="text-body-lg font-bold text-on-surface">
                          #{getLocalizedTag(highestTag.tag, t)} ({highestTag.avg_mood})
                        </p>
                      </div>
                    </div>
                  )}

                  {lowestTag && (
                    <div className="flex items-center gap-md rounded-lg bg-secondary-container/30 border border-outline-variant/20 p-md shadow-subtle">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-on-secondary">
                        <span className="material-symbols-outlined">sentiment_dissatisfied</span>
                      </span>
                      <div>
                        <span className="text-label-sm font-medium text-on-surface-variant">
                          {t("stats.lowestMoodTag")}
                        </span>
                        <p className="text-body-lg font-bold text-on-surface">
                          #{getLocalizedTag(lowestTag.tag, t)} ({lowestTag.avg_mood})
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tags Table / List (only show tags with has_enough_data) */}
              {(() => {
                const validTags = tagCorrelation.filter((item) => item.has_enough_data);
                if (validTags.length === 0) {
                  return (
                    <p className="py-4 text-center text-body-sm text-on-surface-variant/70 italic">
                      {t("stats.insufficientData")}
                    </p>
                  );
                }
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-sm pt-xs">
                    {validTags.map((item) => (
                      <div
                        key={item.tag}
                        className="flex items-center justify-between rounded-md bg-surface-container-low border border-outline-variant/15 p-sm px-md transition-colors"
                      >
                        <span className="text-body-md font-bold text-primary truncate max-w-[150px]">
                          #{getLocalizedTag(item.tag, t)}
                        </span>
                        <div className="flex items-center gap-xs">
                          <span className="text-body-md font-bold text-on-surface">
                            {item.avg_mood}
                          </span>
                          <span className="text-label-sm text-on-surface-variant/60">
                            ({item.entry_count})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </section>

            {/* Annual Heatmap (GitHub Contribution Style) */}
            <section className="rounded-xl lg:rounded-xxl bg-surface-container-lowest border border-outline-variant/20 p-md lg:p-8 shadow-card space-y-md">
              <div className="flex items-center justify-between">
                <h2 className="text-headline-sm font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">grid_on</span>
                  {t("stats.annualHeatmap")}
                </h2>
              </div>

              {/* Heatmap Component */}
              <AnnualHeatmap
                heatmapData={heatmapData}
                activeDay={activeHeatmapDay}
                setActiveDay={setActiveHeatmapDay}
                t={t}
              />
            </section>
          </div>
        )}
      </main>
    </AppLayout>
  );
}

/* Mood Line Chart SVG Component */
function MoodLineChart({ series, period }) {
  if (!series || series.length === 0) return null;

  const validPoints = series.map((pt, index) => {
    const x = (index / (series.length - 1 || 1)) * 300 + 20;
    const y = pt.mood ? 75 - ((pt.mood - 1) / 4) * 55 : 75;
    return { ...pt, x, y, hasVal: pt.mood !== null };
  });

  const loggedPoints = validPoints.filter((p) => p.hasVal);
  const pathD = getSmoothPath(loggedPoints);

  const areaD =
    loggedPoints.length > 0
      ? `${pathD} L ${loggedPoints[loggedPoints.length - 1].x},85 L ${loggedPoints[0].x},85 Z`
      : "";

  return (
    <div className="relative w-full">
      <svg viewBox="0 0 340 105" className="w-full overflow-visible">
        <defs>
          <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--color-primary))" stopOpacity="0.3" />
            <stop offset="100%" stopColor="rgb(var(--color-primary))" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[1, 2, 3, 4, 5].map((level) => {
          const y = 75 - ((level - 1) / 4) * 55;
          return (
            <g key={level}>
              <line
                x1="20"
                y1={y}
                x2="320"
                y2={y}
                stroke="currentColor"
                strokeDasharray="2 2"
                className="text-outline-variant/25"
                strokeWidth="0.8"
              />
            </g>
          );
        })}

        {/* Gradient Fill */}
        {loggedPoints.length > 0 && <path d={areaD} fill="url(#lineAreaGrad)" />}

        {/* Bezier Path */}
        {loggedPoints.length > 0 && (
          <path
            d={pathD}
            fill="none"
            stroke="rgb(var(--color-primary))"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Points & Labels */}
        {validPoints.map((pt, i) => (
          <g key={i}>
            {pt.hasVal && (
              <>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="5"
                  className="fill-surface-container-lowest stroke-primary"
                  strokeWidth="2.5"
                />
                <circle cx={pt.x} cy={pt.y} r="2" className="fill-primary" />
              </>
            )}
            {/* Show x label periodically */}
            {(period !== "month" || i % 4 === 0 || i === validPoints.length - 1) && (
              <text
                x={pt.x}
                y="98"
                textAnchor="middle"
                className="fill-on-surface-variant/60 text-[9px] font-medium"
              >
                {pt.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

/* Day-of-Week Bar Chart Component */
function DayOfWeekBarChart({ data, t, language }) {
  const daysRu = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];
  const daysEn = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const dayLabels = language === "ru" ? daysRu : daysEn;

  return (
    <div className="flex items-end justify-between gap-xs pt-4 h-48">
      {Array.from({ length: 7 }, (_, i) => i + 1).map((dow, idx) => {
        const item = data.find((d) => d.day === dow);
        const avg = item?.avg_mood || 0;
        const heightPct = (avg / 5) * 100;
        return (
          <div key={dow} className="flex-1 flex flex-col items-center h-full justify-end gap-1">
            {avg > 0 ? (
              <span className="text-[11px] font-bold text-primary">{avg}</span>
            ) : (
              <span className="text-[11px] text-on-surface-variant/40">—</span>
            )}
            <div className="w-full max-w-[28px] bg-surface-container-low rounded-t-xl h-32 flex items-end overflow-hidden p-0.5">
              <div
                className="w-full bg-primary rounded-t-lg transition-all duration-500"
                style={{ height: `${heightPct}%` }}
              />
            </div>
            <span className="text-label-sm font-bold text-on-surface-variant/70 mt-1">
              {dayLabels[idx]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* Annual Heatmap Component (GitHub Contribution Style) */
function AnnualHeatmap({ heatmapData, activeDay, setActiveDay, t }) {
  const scrollRef = useRef(null);
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

    return headers;
  }, [weeks, months]);

  // Auto-scroll to rightmost (current date) on mount/update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [weeks]);

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
      <div className="py-8 text-center text-body-sm text-on-surface-variant/70 italic">
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
            gridTemplateColumns: `auto repeat(${weeks.length}, minmax(11px, 12px))`,
            gridTemplateRows: `auto repeat(7, minmax(11px, 12px))`,
          }}
        >
          {/* Sticky top-left corner */}
          <div className="sticky left-0 bg-surface-container-lowest z-20 pr-2 border-r border-outline-variant/10 shadow-[2px_0_4px_rgba(0,0,0,0.03)]" />

          {/* Month Headers */}
          {monthHeaders.map((header) => (
            <div
              key={`${header.monthIdx}-${header.weekIdx}`}
              className="text-[10px] font-medium text-on-surface-variant/70 whitespace-nowrap overflow-visible leading-none pb-1"
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
              className="sticky left-0 bg-surface-container-lowest z-20 pr-2 flex items-center justify-end text-[10px] font-medium text-on-surface-variant/60 leading-none border-r border-outline-variant/10 shadow-[2px_0_4px_rgba(0,0,0,0.03)] min-w-[24px]"
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
                    className="h-3 w-3 rounded-[2px] opacity-0 pointer-events-none"
                  />
                );
              }

              const hasMood = day.mood !== null && day.mood !== undefined;
              const isSelected = activeDay?.date === day.date;

              return (
                <button
                  key={day.date}
                  type="button"
                  title={`${formatDate(day.date)}: ${hasMood ? `${day.mood}/5` : t("stats.noData")}`}
                  onClick={() => setActiveDay(day)}
                  style={{
                    gridRow: dIdx + 2,
                    gridColumn: wIdx + 2,
                  }}
                  className={`h-3 w-3 rounded-[2px] border transition-all ${
                    hasMood
                      ? moodColors[day.mood]
                      : "bg-surface-container-low border-outline-variant/20 dark:bg-surface-container/60 hover:border-outline-variant/60"
                  } ${
                    isSelected
                      ? "ring-2 ring-primary ring-offset-1 ring-offset-surface-container-lowest z-10 scale-125"
                      : "hover:scale-125 hover:z-10"
                  }`}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Selected Day Tooltip Detail */}
      {activeDay && (
        <div className="flex items-center justify-between rounded-2xl bg-surface-container-low p-3 text-body-sm cloud-shadow animate-fade-in border border-outline-variant/15">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">calendar_today</span>
            <div>
              <span className="font-semibold text-on-surface">{formatDate(activeDay.date)}</span>
              <span className="text-on-surface-variant/70 mx-1.5">•</span>
              {activeDay.mood ? (
                <span className="font-bold text-primary">
                  {t(`moods.${activeDay.mood}`)} ({activeDay.mood}/5)
                </span>
              ) : (
                <span className="text-on-surface-variant/70">{t("stats.noData")}</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveDay(null)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
            aria-label={t("common.close")}
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* GitHub-style Legend */}
      <div className="flex flex-wrap items-center justify-between gap-sm text-label-sm text-on-surface-variant/80 pt-xs border-t border-outline-variant/15">
        <span className="font-medium text-[12px]">{t("stats.heatmapLegend")}</span>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-on-surface-variant/70 mr-0.5">{t("stats.less", "Less")}</span>
          <span
            className="h-3 w-3 rounded-[2px] bg-surface-container-low border border-outline-variant/20 dark:bg-surface-container/60"
            title={t("stats.noData")}
          />
          {[1, 2, 3, 4, 5].map((m) => (
            <span
              key={m}
              className={`h-3 w-3 rounded-[2px] border ${moodColors[m]}`}
              title={`${m}/5`}
            />
          ))}
          <span className="text-on-surface-variant/70 ml-0.5">{t("stats.more", "More")}</span>
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
