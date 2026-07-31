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

export function getMoodInfo(mood) {
  return MOODS[mood] || MOODS[3];
}

export const TAG_CATEGORIES = [
  {
    key: "positive",
    label: "Positive",
    tags: ["Calm", "Chill", "Motivated", "Grateful", "Inspired", "Peaceful"],
  },
  {
    key: "neutral",
    label: "Neutral",
    tags: ["Okay", "Neutral", "Bored", "Focused", "Steady", "Meh"],
  },
  {
    key: "difficult",
    label: "Difficult",
    tags: [
      "Tired",
      "Anxious",
      "Overwhelmed",
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
