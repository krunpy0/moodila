export const MOODS = {
  1: {
    value: 1,
    icon: "sentiment_very_dissatisfied",
    label: "Awful",
    shortLabel: "Awful",
    color: "text-mood-awful",
    bg: "bg-mood-awful-container",
    border: "border-mood-awful/20",
    onContainer: "text-on-mood-awful-container",
  },
  2: {
    value: 2,
    icon: "sentiment_dissatisfied",
    label: "Bad",
    shortLabel: "Bad",
    color: "text-mood-bad",
    bg: "bg-mood-bad-container",
    border: "border-mood-bad/20",
    onContainer: "text-on-mood-bad-container",
  },
  3: {
    value: 3,
    icon: "sentiment_neutral",
    label: "Meh",
    shortLabel: "Meh",
    color: "text-mood-meh",
    bg: "bg-mood-meh-container",
    border: "border-mood-meh/20",
    onContainer: "text-on-mood-meh-container",
  },
  4: {
    value: 4,
    icon: "sentiment_satisfied",
    label: "Good",
    shortLabel: "Good",
    color: "text-mood-good",
    bg: "bg-mood-good-container",
    border: "border-mood-good/20",
    onContainer: "text-on-mood-good-container",
  },
  5: {
    value: 5,
    icon: "sentiment_very_satisfied",
    label: "Rad",
    shortLabel: "Rad",
    color: "text-mood-rad",
    bg: "bg-mood-rad-container",
    border: "border-mood-rad/20",
    onContainer: "text-on-mood-rad-container",
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
  const trimmed = typeof tag === "string" ? tag.trim() : String(tag);
  if (!trimmed) return "";
  if (!t) return trimmed;
  return t(`moods.tags.${trimmed}`, trimmed);
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
