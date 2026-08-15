export const MOODS = {
  1: {
    value: 1,
    icon: "sentiment_very_dissatisfied",
    label: "Rough",
    shortLabel: "Very Low",
    color: "text-error",
    bg: "bg-error-container/30",
    border: "border-error/20",
  },
  2: {
    value: 2,
    icon: "sentiment_dissatisfied",
    label: "Low",
    shortLabel: "Low",
    color: "text-amber-600 dark:text-amber-300",
    bg: "bg-amber-500/20 dark:bg-amber-500/30",
    border: "border-amber-500/20",
  },
  3: {
    value: 3,
    icon: "sentiment_neutral",
    label: "Okay",
    shortLabel: "Neutral",
    color: "text-secondary",
    bg: "bg-secondary-container/30",
    border: "border-secondary/20",
  },
  4: {
    value: 4,
    icon: "sentiment_satisfied",
    label: "Good",
    shortLabel: "Good",
    color: "text-primary",
    bg: "bg-primary-container/30",
    border: "border-primary/20",
  },
  5: {
    value: 5,
    icon: "sentiment_very_satisfied",
    label: "Great",
    shortLabel: "Great",
    color: "text-tertiary",
    bg: "bg-tertiary-container/40",
    border: "border-tertiary/20",
  },
};

export function getMoodInfo(mood, t) {
  const base = MOODS[mood] || MOODS[3];
  if (!t) return base;
  return {
    ...base,
    label: t(`moods.${base.value}`, base.label),
    shortLabel: t(`moods.short${base.value}`, base.shortLabel),
  };
}

export const TAG_CATEGORIES = [
  {
    key: "positive",
    label: "Positive",
    tags: [
      "Calm",
      "Chill",
      "Motivated",
      "Grateful",
      "Inspired",
      "Peaceful",
      "Happy",
      "Excited",
      "Optimistic",
    ],
  },
  {
    key: "neutral",
    label: "Neutral",
    tags: [
      "Okay",
      "Neutral",
      "Bored",
      "Focused",
      "Steady",
      "Meh",
      "Unsure",
      "Indifferent",
    ],
  },
  {
    key: "difficult",
    label: "Difficult",
    tags: [
      "Tired",
      "Anxious",
      "Overwhelmed",
      "Suicidal",
      "Frustrated",
      "Lonely",
      "Drained",
      "Emotional",
    ],
  },
];

export const ALL_TAGS = TAG_CATEGORIES.flatMap((cat) => cat.tags);

export const DEFAULT_TAGS = ALL_TAGS;

export function getTagsForMood() {
  return ALL_TAGS;
}

export function getLocalizedTag(tag, t) {
  if (!tag) return "";
  if (!t) return tag;
  return t(`moods.tags.${tag}`, tag);
}

export function getLocalizedInsightText(insight, t) {
  if (!insight) return "";

  const rawKey = insight.template_key || insight.templateKey;
  let key = rawKey;
  if (rawKey && rawKey.startsWith("insight.")) {
    key = `stats.insights.${rawKey.replace("insight.", "")}`;
  } else if (!rawKey && insight.id) {
    if (insight.id.startsWith("day_lower")) key = "stats.insights.day_lower";
    else if (insight.id.startsWith("day_higher"))
      key = "stats.insights.day_higher";
    else if (insight.id.startsWith("tag_lower"))
      key = "stats.insights.tag_lower";
    else if (insight.id.startsWith("tag_higher"))
      key = "stats.insights.tag_higher";
  }

  if (key && t) {
    const params = { ...(insight.params || {}) };
    if (params.day !== undefined && params.day !== null) {
      const localizedDay = t(`stats.insights.daysPlural.${params.day}`);
      if (
        localizedDay &&
        localizedDay !== `stats.insights.daysPlural.${params.day}`
      ) {
        params.day = localizedDay;
      } else {
        params.day = params.day_ru || params.day_name || params.day;
      }
    } else if (params.day_ru) {
      params.day = params.day_ru;
    }

    if (params.tag) {
      params.tag = getLocalizedTag(params.tag, t);
    }

    const translated = t(key, params);
    if (translated && translated !== key) {
      return translated;
    }
  }

  return insight.text || "";
}
