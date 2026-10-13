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
      "Dirty",
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

const TAG_EMOJI_MAP = {
  // Positive (EN)
  Calm: "🌿",
  Chill: "☕",
  Motivated: "⚡",
  Grateful: "🙏",
  Inspired: "💡",
  Peaceful: "🕊️",
  Happy: "😊",
  Excited: "✨",
  Optimistic: "☀️",
  // Neutral (EN)
  Okay: "👌",
  Neutral: "😐",
  Bored: "🥱",
  Focused: "🎯",
  Steady: "⚓",
  Meh: "💭",
  Unsure: "🤔",
  Indifferent: "😶",
  // Difficult (EN)
  Tired: "💤",
  Anxious: "🌧️",
  Overwhelmed: "🌊",
  Suicidal: "🖤",
  Frustrated: "💢",
  Lonely: "🥀",
  Drained: "🔋",
  Emotional: "💧",
  Dirty: "🚿",
  // Positive (RU)
  Спокойствие: "🌿",
  Отдых: "☕",
  Мотивация: "⚡",
  Благодарность: "🙏",
  Вдохновение: "💡",
  Умиротворение: "🕊️",
  Счастье: "😊",
  Восторг: "✨",
  Оптимизм: "☀️",
  // Neutral (RU)
  Нормально: "👌",
  Нейтрально: "😐",
  Скука: "🥱",
  Фокус: "🎯",
  Стабильно: "⚓",
  "Так себе": "💭",
  Неуверенность: "🤔",
  Безразличие: "😶",
  // Difficult (RU)
  Усталость: "💤",
  Тревога: "🌧️",
  Перегрузка: "🌊",
  Суицидально: "🖤",
  Раздражение: "💢",
  Одиночество: "🥀",
  Опустошение: "🔋",
  Эмоционально: "💧",
  Грязно: "🚿",
};

const KEYWORD_EMOJI_RULES = [
  { match: /(устал|сон|выгор|бессил|tired|sleep|drain|exhaust)/i, emoji: "💤" },
  { match: /(тревог|паник|панич|стресс|нерв|anxi|panic|stress|overwhelm)/i, emoji: "🌧️" },
  { match: /(груст|печал|плач|слез|тоск|одинок|depress|sad|cry|tear|lonely|alone)/i, emoji: "🥀" },
  { match: /(зло|бесит|ярост|раздраж|гнев|anger|angry|mad|frustrat)/i, emoji: "💢" },
  { match: /(радост|счаст|кайф|весел|смех|happy|joy|glad|fun)/i, emoji: "😊" },
  { match: /(восторг|маги|чудо|sparkle|excit|magic)/i, emoji: "✨" },
  { match: /(благодар|спас|grate|thank)/i, emoji: "🙏" },
  { match: /(вдохнов|мотив|идея|план|цел|motiv|inspir|idea|goal)/i, emoji: "💡" },
  { match: /(спокой|мир|тишин|релакс|умиротвор|calm|peace|chill|relax)/i, emoji: "🌿" },
  { match: /(спорт|зал|тренир|бег|фитнес|gym|run|workout|fit|sport)/i, emoji: "🏃" },
  { match: /(работ|дедлайн|проект|work|project|code|focus|фокус)/i, emoji: "🎯" },
  { match: /(учеб|универ|школ|лекци|экзамен|сесси|study|exam|course)/i, emoji: "📚" },
  { match: /(еда|кофе|чай|обед|ужин|завтрак|отдых|food|coffee|tea|eat|cook)/i, emoji: "☕" },
  { match: /(прогулк|парк|природ|солнц|лес|walk|nature|sun)/i, emoji: "🍃" },
  { match: /(любов|свидан|партнер|love|date)/i, emoji: "💛" },
  { match: /(друг|друзь|тусов|встреч|компан|friend|party)/i, emoji: "👥" },
  { match: /(книг|чита|book|read)/i, emoji: "📖" },
  { match: /(кино|фильм|сериал|movie|cinema)/i, emoji: "🎬" },
  { match: /(игр|гейм|плей|game|play)/i, emoji: "🎮" },
  { match: /(музык|песн|трек|music|song)/i, emoji: "🎵" },
  { match: /(путешеств|поездк|дорог|полет|travel|trip|flight)/i, emoji: "✈️" },
  { match: /(кот|кошк|собак|животн|питом|cat|dog|pet)/i, emoji: "🐾" },
  { match: /(дом|уют|семья|home|family)/i, emoji: "🏡" },
  { match: /(творчеств|рисова|арт|дизайн|art|design|draw)/i, emoji: "🎨" },
  { match: /(здоровь|болезн|лекарств|врач|боль|health|sick|med)/i, emoji: "💊" },
  { match: /(покупк|шоппинг|деньг|shop|buy|money)/i, emoji: "🛍️" },
];

export function getTagSemanticIcon(tag) {
  if (!tag) return "🏷️";
  const trimmed = typeof tag === "string" ? tag.trim() : String(tag);
  if (TAG_EMOJI_MAP[trimmed]) {
    return TAG_EMOJI_MAP[trimmed];
  }
  for (const rule of KEYWORD_EMOJI_RULES) {
    if (rule.match.test(trimmed)) {
      return rule.emoji;
    }
  }
  for (const cat of TAG_CATEGORIES) {
    if (cat.tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      if (cat.key === "positive") return "😊";
      if (cat.key === "difficult") return "🌧️";
      return "🏷️";
    }
  }
  return "🏷️";
}

export function formatPlural(n, { one, few, many }, lang = "ru") {
  const count = Math.abs(n || 0);
  if (lang === "ru" || (typeof lang === "string" && lang.startsWith("ru"))) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod100 >= 11 && mod100 <= 19) {
      return `${count} ${many}`;
    }
    if (mod10 === 1) {
      return `${count} ${one}`;
    }
    if (mod10 >= 2 && mod10 <= 4) {
      return `${count} ${few}`;
    }
    return `${count} ${many}`;
  }
  return `${count} ${count === 1 ? one : few || many}`;
}

