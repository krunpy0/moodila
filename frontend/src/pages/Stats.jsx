/* Hallmark · macrostructure: Stat-Led · tone: soft-editorial · design-system: DESIGN.md */
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

  const heroMoodLevel = stats?.overall_avg_mood ? Math.round(stats.overall_avg_mood) : 3;
  const heroMoodInfo = getMoodInfo(heroMoodLevel, t);

  return (
    <AppLayout>
      <main className="mx-auto min-h-screen w-full max-w-md md:max-w-2xl lg:max-w-5xl xl:max-w-6xl bg-background pb-32 lg:pb-12 text-on-surface px-container-margin-mobile md:px-container-margin py-xs md:py-sm">
        {/* Header */}
        <header className="py-md flex items-center justify-between">
          <div className="flex items-center gap-sm">
            <button
              type="button"
              onClick={() => safeNavigateBack(navigate, "/home")}
              aria-label={t("common.back")}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface-variant shadow-subtle border border-outline-variant/25 active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <div>
              <h1 className="text-headline-lg font-headline-lg lg:text-3xl font-bold tracking-tight">
                {t("stats.title")}
              </h1>
              <p className="text-label-sm font-label-sm text-on-surface-variant">
                {t("stats.subtitle")}
              </p>
            </div>
          </div>
        </header>

        {isLoading ? (
          <StatsSkeleton />
        ) : isError ? (
          <div className="py-8 text-center text-error">
            {error?.message || t("common.error")}
          </div>
        ) : (
          <div className="space-y-lg">
            {/* Editorial Hero Summary & Dynamics Chart */}
            <section className="rounded-2xl lg:rounded-xxl bg-surface-container-lowest border border-outline-variant/20 p-md md:p-6 lg:p-8 shadow-card space-y-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
                <div className="flex items-center gap-md">
                  {stats?.overall_avg_mood ? (
                    <>
                      <div className={`flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl ${heroMoodInfo.bg}`}>
                        <MoodIcon mood={heroMoodLevel} className="text-[28px]" />
                      </div>
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-display-md font-bold tracking-tight text-on-surface tabular-nums">
                            {Number(stats.overall_avg_mood).toFixed(1)}
                          </span>
                          <span className="text-body-md font-semibold text-on-surface-variant">/ 5</span>
                          <span className={`text-label-md font-bold px-2.5 py-0.5 rounded-full ${heroMoodInfo.bg} ${heroMoodInfo.onContainer}`}>
                            {heroMoodInfo.label}
                          </span>
                        </div>
                        <p className="text-label-sm font-medium text-on-surface-variant tabular-nums mt-0.5">
                          {t("stats.avgMood")} • {stats.total_entries} {t("stats.entriesCount")}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div>
                      <h2 className="text-headline-sm font-bold text-on-surface">
                        {t("stats.moodDynamics")}
                      </h2>
                      <p className="text-label-sm text-on-surface-variant">
                        {t("stats.noStatsData")}
                      </p>
                    </div>
                  )}
                </div>

                {/* Period Switcher */}
                <div className="flex rounded-full bg-surface-container-low p-1 self-start sm:self-auto border border-outline-variant/15">
                  {["week", "month", "year"].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPeriod(p)}
                      className={`px-3.5 py-1.5 text-label-md font-semibold rounded-full transition-colors ${
                        period === p
                          ? "bg-surface-container-lowest text-on-surface font-bold shadow-subtle"
                          : "text-on-surface-variant hover:text-on-surface"
                      }`}
                    >
                      {t(`stats.periods.${p}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mood Line Chart SVG (Tactile stroke, labeled Y-axis, clean intervals) */}
              <div className="pt-xs">
                <MoodLineChart series={moodSeries} />
              </div>
            </section>

            {/* Observations & Patterns List */}
            {insights.length > 0 && (
              <section className="space-y-sm">
                <div className="flex items-center gap-1.5 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[18px] text-primary">psychology</span>
                  <h2 className="text-label-lg font-bold tracking-wider uppercase">
                    {t("stats.insightsTitle")}
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-sm">
                  {insights.map((insight, idx) => {
                    const isPositive = insight.type === "positive" || String(insight.template_key).includes("higher");
                    const isNegative = insight.type === "negative" || String(insight.template_key).includes("lower");
                    const iconName = isPositive ? "trending_up" : isNegative ? "trending_down" : "auto_awesome";
                    const badgeClass = isPositive
                      ? "text-mood-rad bg-mood-rad-container"
                      : isNegative
                      ? "text-mood-bad bg-mood-bad-container"
                      : "text-primary bg-primary-container";

                    return (
                      <div
                        key={insight.id || idx}
                        className="flex items-start gap-md rounded-xl bg-surface-container-low border border-outline-variant/15 p-md shadow-subtle"
                      >
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${badgeClass} mt-0.5`}>
                          <span className="material-symbols-outlined text-[18px]">{iconName}</span>
                        </span>
                        <p className="text-body-md font-medium text-on-surface leading-snug">
                          {getLocalizedInsightText(insight, t)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Mood Balance & Weekly Rhythm Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-md lg:gap-6">
              {/* Mood Distribution */}
              <section className="lg:col-span-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 p-md md:p-6 shadow-card space-y-md">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">pie_chart</span>
                  <h2 className="text-headline-sm font-bold text-on-surface">
                    {t("stats.moodDistribution")}
                  </h2>
                </div>
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
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${moodInfo.bg}`}>
                          <MoodIcon mood={level} className="text-[18px]" />
                        </span>
                        <div className="w-20 text-body-sm font-medium text-on-surface truncate">
                          {moodInfo.label}
                        </div>
                        <div className="flex-1 h-3 rounded-full bg-surface-container-low overflow-hidden">
                          <div
                            className={`h-full w-full rounded-full ${moodBarColors[level] || "bg-primary"} origin-left transition-transform duration-300 ease-out`}
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
              <section className="lg:col-span-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 p-md md:p-6 shadow-card space-y-md">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">calendar_view_week</span>
                  <h2 className="text-headline-sm font-bold text-on-surface">
                    {t("stats.dayOfWeekPattern")}
                  </h2>
                </div>
                <DayOfWeekBarChart data={dayOfWeekAverages} language={language} t={t} />
              </section>
            </div>

            {/* Tag Influence & Context */}
            <section className="rounded-2xl bg-surface-container-lowest border border-outline-variant/20 p-md md:p-6 shadow-card space-y-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-xs">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">tag</span>
                  <h2 className="text-headline-sm font-bold text-on-surface">
                    {t("stats.tagCorrelation")}
                  </h2>
                </div>
                <span className="text-label-sm text-on-surface-variant font-medium">
                  {t("stats.minTagDataNote")}
                </span>
              </div>

              {/* Top / Bottom Tag Highlight Cards */}
              {(highestTag || lowestTag) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
                  {highestTag && (
                    <div className="flex items-center gap-md rounded-xl bg-mood-rad-container/25 border border-mood-rad/20 p-md shadow-subtle">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-mood-rad-container border border-mood-rad/30">
                        <MoodIcon mood={Math.min(5, Math.max(1, Math.round(highestTag.avg_mood)))} className="text-[26px]" />
                      </span>
                      <div className="min-w-0">
                        <span className="text-label-sm font-semibold text-on-mood-rad-container block">
                          {t("stats.highestMoodTag")}
                        </span>
                        <p className="text-body-md font-bold text-on-surface truncate">
                          #{getLocalizedTag(highestTag.tag, t)}{" "}
                          <span className="text-mood-rad font-bold tabular-nums">
                            ({Number(highestTag.avg_mood).toFixed(1)})
                          </span>
                        </p>
                      </div>
                    </div>
                  )}

                  {lowestTag && (
                    <div className="flex items-center gap-md rounded-xl bg-mood-awful-container/25 border border-mood-awful/20 p-md shadow-subtle">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-mood-awful-container border border-mood-awful/30">
                        <MoodIcon mood={Math.min(5, Math.max(1, Math.round(lowestTag.avg_mood)))} className="text-[26px]" />
                      </span>
                      <div className="min-w-0">
                        <span className="text-label-sm font-semibold text-on-mood-awful-container block">
                          {t("stats.lowestMoodTag")}
                        </span>
                        <p className="text-body-md font-bold text-on-surface truncate">
                          #{getLocalizedTag(lowestTag.tag, t)}{" "}
                          <span className="text-mood-awful font-bold tabular-nums">
                            ({Number(lowestTag.avg_mood).toFixed(1)})
                          </span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tags Grid / List */}
              {(() => {
                const validTags = tagCorrelation.filter((item) => item.has_enough_data);
                if (validTags.length === 0) {
                  return (
                    <div className="py-6 text-center text-body-sm text-on-surface-variant font-medium">
                      {t("stats.insufficientData")}
                    </div>
                  );
                }
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-xs pt-xs">
                    {validTags.map((item) => {
                      const tagMoodLevel = Math.min(5, Math.max(1, Math.round(item.avg_mood)));
                      const tagMoodInfo = getMoodInfo(tagMoodLevel, t);
                      return (
                        <div
                          key={item.tag}
                          className="flex items-center justify-between rounded-xl bg-surface-container-low border border-outline-variant/15 py-2 px-3 transition-colors hover:bg-surface-container"
                        >
                          <div className="flex items-center gap-2.5 truncate max-w-[170px]">
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tagMoodInfo.bg}`}>
                              <MoodIcon mood={tagMoodLevel} className="text-[17px]" />
                            </span>
                            <span className="text-body-md font-semibold text-on-surface truncate">
                              #{getLocalizedTag(item.tag, t)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-body-md font-bold text-on-surface tabular-nums">
                              {Number(item.avg_mood).toFixed(1)}
                            </span>
                            <span className="text-label-sm text-on-surface-variant tabular-nums">
                              ({item.entry_count})
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </section>

            {/* Annual Heatmap (Moodila Emotional Spectrum) */}
            <section className="rounded-2xl bg-surface-container-lowest border border-outline-variant/20 p-md md:p-6 shadow-card space-y-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">grid_on</span>
                  <h2 className="text-headline-sm font-bold text-on-surface">
                    {t("stats.annualHeatmap")}
                  </h2>
                </div>
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
function MoodLineChart({ series }) {
  if (!series || series.length === 0) {
    return null;
  }

  // Width is 360, X-margin left is 34, right margin is 346
  const plotLeft = 34;
  const plotRight = 346;
  const plotWidth = plotRight - plotLeft;

  const validPoints = series.map((pt, index) => {
    const x = (index / (series.length - 1 || 1)) * plotWidth + plotLeft;
    const y = pt.mood ? 80 - ((pt.mood - 1) / 4) * 60 : 80;
    return { ...pt, x, y, hasVal: pt.mood !== null };
  });

  const loggedPoints = validPoints.filter((p) => p.hasVal);
  const pathD = getSmoothPath(loggedPoints);

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
    <div className="relative w-full">
      <svg viewBox="0 0 360 115" className="w-full overflow-visible">
        {/* Y-axis Grid lines & Level labels */}
        {[1, 2, 3, 4, 5].map((level) => {
          const y = 80 - ((level - 1) / 4) * 60;
          return (
            <g key={level}>
              <text
                x={plotLeft - 8}
                y={y + 3}
                textAnchor="end"
                className="fill-on-surface-variant text-[10px] font-semibold tabular-nums select-none"
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

        {/* Clean, tactile Bézier Path (no area gradient slop) */}
        {loggedPoints.length > 0 && (
          <path
            d={pathD}
            fill="none"
            stroke="rgb(var(--color-primary))"
            strokeWidth="2.5"
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
                r={isDense ? "2.5" : "3.5"}
                className="fill-surface-container-lowest stroke-primary"
                strokeWidth={isDense ? "1.5" : "2"}
              />
            )}
            {shouldShowLabel(i) && (
              <text
                x={pt.x}
                y="104"
                textAnchor="middle"
                className="fill-on-surface-variant text-[10px] font-medium tabular-nums select-none"
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
                  className={`h-3 w-3 rounded-[2px] border transition-colors focus:outline-none ${
                    hasMood
                      ? moodColors[day.mood]
                      : "bg-surface-container-low border-outline-variant/20 dark:bg-surface-container/60 hover:border-outline-variant/60"
                  } ${
                    isSelected
                      ? "ring-2 ring-primary ring-offset-1 ring-offset-surface-container-lowest z-10"
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
        <div className="flex items-center justify-between rounded-xl bg-surface-container-low p-3 text-body-sm shadow-subtle border border-outline-variant/20">
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
            className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
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
