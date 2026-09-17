/* Hallmark · macrostructure: Bento Grid · genre: editorial · theme: Soft Editorial
 * fonts: Newsreader + Plus Jakarta Sans · enrichment: Tier-A pure CSS interactive widgets
 * nav: N5 Floating pill · footer: Ft5 Statement
 * mobile: pass (34, 49, 50–57) · contrast: pass (40–41) · honest: pass (46) · chrome: pass (47)
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import AppLogo from '../components/AppLogo';
import MoodIcon from '../components/MoodIcon';
import { MOODS, TAG_CATEGORIES, getMoodInfo, getLocalizedTag } from '../utils/moods';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

const WAVEFORM_HEIGHTS = [
  35, 60, 40, 75, 50, 90, 65, 40, 80, 100, 70, 45, 85, 95, 60, 40, 75, 50, 85, 90, 60, 40, 55, 35, 65, 80, 45, 30
];

// Sample calendar data for monthly mood matrix
const CALENDAR_DAYS = [
  { day: 1, mood: 4 }, { day: 2, mood: 5 }, { day: 3, mood: 4 }, { day: 4, mood: 3 },
  { day: 5, mood: 4 }, { day: 6, mood: 5 }, { day: 7, mood: 5 }, { day: 8, mood: 4 },
  { day: 9, mood: 2, isHidden: true }, { day: 10, mood: 3 }, { day: 11, mood: 4 }, { day: 12, mood: 4 },
  { day: 13, mood: 5 }, { day: 14, mood: 5 }, { day: 15, mood: 4 }, { day: 16, mood: 3 },
  { day: 17, mood: 4 }, { day: 18, mood: 5 }, { day: 19, mood: 4 }, { day: 20, mood: 5 },
  { day: 21, mood: 4, hasCustom: true }, { day: 22, mood: 3 }, { day: 23, mood: 2 }, { day: 24, mood: 4 },
  { day: 25, mood: 5 }, { day: 26, mood: 5 }, { day: 27, mood: 4 }, { day: 28, mood: 5 },
];

export default function Landing() {
  const { t, language, toggleLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  // 1:1 AddEntry Hero Interactive state
  const [heroMood, setHeroMood] = useState(4);
  const [heroTags, setHeroTags] = useState(['Calm', 'Grateful']);
  const [heroNote, setHeroNote] = useState(
    language === 'ru'
      ? 'Спокойный вечер с чаем и хорошей музыкой. Удалось отдохнуть и перезагрузиться.'
      : 'Quiet evening with tea and good music. Felt nice and relaxing.'
  );
  const [heroIsPlayingAudio, setHeroIsPlayingAudio] = useState(false);
  const [heroAudioSpeed, setHeroAudioSpeed] = useState(1);
  const [heroIsHidden, setHeroIsHidden] = useState(false);

  // 1:1 Bento Tile 1: Privacy Modal state
  const [friendsPrivacy, setFriendsPrivacy] = useState([
    { id: 1, name: 'Anna Karenina', username: 'anna_k', hidden: false, initial: 'A' },
    { id: 2, name: 'Leo Tolstoy', username: 'leo_t', hidden: false, initial: 'L' },
    { id: 3, name: 'Daniel Kim', username: 'daniel', hidden: true, initial: 'D' },
  ]);

  // 1:1 Bento Tile 2: Audio player demo state
  const [tileAudioPlaying, setTileAudioPlaying] = useState(false);
  const [tileAudioSpeed, setTileAudioSpeed] = useState(1.5);

  // 1:1 Bento Tile 3: Feed Card reaction state
  const [feedLiked, setFeedLiked] = useState(true);

  // 1:1 Bento Tile 4: Calendar selected day
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(18);

  // FAQ Accordion open index
  const [openFaq, setOpenFaq] = useState(0);

  const isRu = language === 'ru';

  const toggleHeroTag = (tag) => {
    setHeroTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  };

  const toggleFriendPrivacy = (friendId) => {
    setFriendsPrivacy((prev) =>
      prev.map((f) => (f.id === friendId ? { ...f, hidden: !f.hidden } : f))
    );
  };

  return (
    <div className="min-h-screen bg-background text-on-surface selection:bg-primary-container selection:text-on-primary-container font-sans antialiased overflow-x-clip transition-colors duration-200">
      {/* N5 FLOATING PILL NAVIGATION */}
      <header className="fixed top-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-4xl" role="banner">
        <nav
          aria-label="Main navigation"
          className="flex items-center justify-between px-4 py-2.5 rounded-full bg-surface-container-lowest/85 dark:bg-surface-container/85 backdrop-blur-md border border-outline-variant/30 shadow-floating transition-colors"
        >
          {/* Brand Wordmark */}
          <Link
            to="/"
            className="flex items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 rounded-full py-1 pr-2"
          >
            <AppLogo className="w-7 h-7 rounded-lg shadow-subtle" />
            <span className="font-display text-[21px] font-semibold tracking-tight text-on-surface">
              Moodila
            </span>
          </Link>

          {/* Center Jump Links (Desktop) */}
          <div className="hidden md:flex items-center gap-6 text-label-md text-on-surface-variant">
            <a
              href="#features"
              className="hover:text-on-surface transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-primary"
            >
              {t('landing.navFeatures')}
            </a>
            <a
              href="#philosophy"
              className="hover:text-on-surface transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-primary"
            >
              {t('landing.navPhilosophy')}
            </a>
            <a
              href="#how-it-works"
              className="hover:text-on-surface transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-primary"
            >
              {t('landing.navHowItWorks')}
            </a>
            <a
              href="#faq"
              className="hover:text-on-surface transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-primary"
            >
              {t('landing.navFaq')}
            </a>
          </div>

          {/* Utility Affordances */}
          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <button
              onClick={toggleLanguage}
              aria-label="Toggle language"
              className="h-9 px-2.5 flex items-center justify-center rounded-full text-label-sm font-semibold border border-outline-variant/30 hover:bg-surface-container-high transition-colors focus-visible:outline-2 focus-visible:outline-primary whitespace-nowrap"
            >
              {isRu ? 'EN' : 'RU'}
            </button>

            {/* Dark/Light Theme Toggle */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="h-9 w-9 flex items-center justify-center rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high border border-outline-variant/30 transition-colors focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span className="material-symbols-outlined text-[18px]">
                {theme === 'dark' ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            {/* CTA to App */}
            <Link
              to="/login"
              className="h-9 px-4 flex items-center justify-center rounded-full bg-primary text-on-primary text-label-md font-semibold hover:opacity-90 active:scale-95 transition-all shadow-subtle focus-visible:outline-2 focus-visible:outline-primary whitespace-nowrap"
            >
              {t('landing.navLogIn')}
            </Link>
          </div>
        </nav>
      </header>

      {/* HERO SECTION (H2 SPLIT DIPTYCH WITH 1:1 ADDENTRY HERO INTERACTIVE DEMO) */}
      <section className="pt-32 pb-16 md:pt-40 md:pb-24 px-container-margin max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left Column: Literary Statement & Direction */}
          <div className="lg:col-span-6 flex flex-col items-start text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-container/70 text-on-primary-container text-label-sm font-semibold tracking-wide border border-primary/20 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span>{t('landing.heroBadge')}</span>
            </div>

            <h1
              className="font-display text-4xl sm:text-5xl lg:text-[52px] leading-[1.08] font-normal tracking-tight text-on-surface mb-6"
              style={{ overflowWrap: 'anywhere', minWidth: 0 }}
            >
              {t('landing.heroTitle')}
            </h1>

            <p className="text-body-lg text-on-surface-variant leading-relaxed max-w-[54ch] mb-8">
              {t('landing.heroDescription')}
            </p>

            <div className="flex flex-wrap items-center gap-3.5 mb-8">
              <Link
                to="/login"
                className="h-12 px-6 inline-flex items-center justify-center gap-2 rounded-full bg-primary text-on-primary text-label-lg font-semibold hover:shadow-card hover:-translate-y-0.5 active:translate-y-0 active:scale-98 transition-all focus-visible:outline-2 focus-visible:outline-primary whitespace-nowrap"
              >
                <span>{t('landing.heroCtaPrimary')}</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </Link>
              <a
                href="#features"
                className="h-12 px-5 inline-flex items-center justify-center rounded-full bg-surface-container-high text-on-surface text-label-lg font-medium hover:bg-surface-variant transition-colors border border-outline-variant/30 focus-visible:outline-2 focus-visible:outline-primary whitespace-nowrap"
              >
                {t('landing.heroCtaSecondary')}
              </a>
            </div>

            <div className="flex items-center gap-2 text-body-sm text-on-surface-variant/80">
              <span className="material-symbols-outlined text-[16px] text-primary">verified_user</span>
              <span>{t('landing.heroReassurance')}</span>
            </div>
          </div>

          {/* Right Column: 1:1 REAL APP AddEntry.jsx Interactive Component */}
          <div className="lg:col-span-6 w-full space-y-4">
            {/* 1:1 AddEntry Section: Mood Picker + Tag Categories */}
            <div className="rounded-xl lg:rounded-xxl bg-surface-container-lowest p-lg shadow-card border border-outline-variant/20 space-y-md">
              <div className="flex items-center justify-between pb-sm border-b border-outline-variant/15">
                <div>
                  <h3 className="text-label-lg font-bold text-on-surface">
                    {t('landing.demoTitle')}
                  </h3>
                  <p className="text-body-sm text-on-surface-variant">
                    {t('landing.demoSubtitle')}
                  </p>
                </div>
                <span className="text-label-sm font-semibold px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant border border-outline-variant/20">
                  {isRu ? 'Сегодня, 21:30' : 'Today, 9:30 PM'}
                </span>
              </div>

              {/* Real 1:1 Mood Buttons from AddEntry.jsx */}
              <div className="flex items-center justify-between gap-1 sm:gap-2 pt-1 pb-1">
                {[1, 2, 3, 4, 5].map((level) => {
                  const item = MOODS[level];
                  const moodInfo = getMoodInfo(level, t);
                  const selected = heroMood === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      aria-label={moodInfo.label}
                      title={moodInfo.label}
                      aria-pressed={selected}
                      onClick={() => setHeroMood(level)}
                      className={`flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full transition-[opacity,transform,box-shadow] duration-normal ease-out active:scale-95 ${item.bg} ${
                        selected
                          ? 'ring-4 ring-primary/40 shadow-card scale-105'
                          : 'opacity-80 hover:opacity-100 hover:-translate-y-0.5'
                      }`}
                    >
                      <MoodIcon mood={level} className="text-[28px] sm:text-[32px]" filled={selected} />
                    </button>
                  );
                })}
              </div>

              {/* Real 1:1 Tag Categories from AddEntry.jsx */}
              <div className="space-y-sm border-t border-outline-variant/15 pt-md">
                {TAG_CATEGORIES.map((category) => (
                  <div key={category.key}>
                    <span className="mb-xs block text-overline font-bold uppercase tracking-wider text-on-surface-variant/70">
                      {t(`moods.categories.${category.key}`, category.label)}
                    </span>
                    <div className="flex flex-wrap gap-xs">
                      {category.tags.slice(0, 5).map((tag) => {
                        const selected = heroTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => toggleHeroTag(tag)}
                            className={`rounded-full px-md py-xs text-label-sm font-medium transition-all duration-fast active:scale-95 ${
                              selected
                                ? 'bg-primary-container text-on-primary-container font-semibold shadow-xs'
                                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                            }`}
                          >
                            {getLocalizedTag(tag, t)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 1:1 AddEntry Section: Note Textarea + 1:1 VoiceNotePlayer */}
            <div className="rounded-xl lg:rounded-xxl bg-surface-container-lowest p-lg shadow-card border border-outline-variant/20">
              <label htmlFor="landing-entry-note" className="mb-md block text-label-lg font-label-lg text-on-surface-variant">
                {t('addEntry.optionalNote')}
              </label>
              <textarea
                id="landing-entry-note"
                value={heroNote}
                maxLength={5000}
                onChange={(e) => setHeroNote(e.target.value)}
                placeholder={t('addEntry.notePlaceholder')}
                className="min-h-[85px] w-full resize-none overflow-hidden bg-transparent p-0 text-body-md font-body-md text-on-surface outline-none placeholder:text-on-surface-variant/40"
              />
              <div className="mt-1 flex justify-end">
                <span className="text-label-sm text-on-surface-variant/60 tabular-nums">
                  {heroNote.length} / 5000
                </span>
              </div>

              {/* 1:1 VoiceNotePlayer from components/VoiceNotePlayer.jsx */}
              <div className="mt-sm mb-md">
                <div className="relative flex flex-col gap-xs rounded-[20px] bg-surface-container-low p-md border border-surface-container-high/60 cloud-shadow">
                  <div className="flex items-center gap-md">
                    <button
                      type="button"
                      onClick={() => setHeroIsPlayingAudio(!heroIsPlayingAudio)}
                      aria-label={heroIsPlayingAudio ? 'Pause voice note' : 'Play voice note'}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary shadow-sm transition-transform active:scale-95 hover:bg-primary/90"
                    >
                      <span className="material-symbols-outlined text-[24px]">
                        {heroIsPlayingAudio ? 'pause' : 'play_arrow'}
                      </span>
                    </button>

                    <div className="flex flex-1 flex-col gap-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <span className="text-label-sm font-medium text-on-surface-variant font-sans tabular-nums min-w-0 truncate">
                          {heroIsPlayingAudio ? '0:24 / 0:42' : '0:00 / 0:42'}
                        </span>
                        <div className="flex items-center gap-xs shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setHeroAudioSpeed((s) => (s === 1 ? 1.5 : s === 1.5 ? 2 : 1))
                            }
                            title="Playback speed"
                            className="shrink-0 rounded-md bg-surface-container px-1.5 py-0.5 text-[11px] font-semibold text-primary hover:bg-surface-container-high"
                          >
                            {heroAudioSpeed}x
                          </button>
                        </div>
                      </div>

                      {/* 1:1 Waveform Bars from VoiceNotePlayer.jsx */}
                      <div
                        className="flex h-7 w-full items-center gap-[3px] py-1 cursor-pointer"
                        role="slider"
                        aria-label="Audio progress"
                        aria-valuenow={heroIsPlayingAudio ? 24 : 0}
                        aria-valuemin={0}
                        aria-valuemax={42}
                      >
                        {WAVEFORM_HEIGHTS.map((heightPercent, idx) => {
                          const isActive = heroIsPlayingAudio && idx <= 15;
                          return (
                            <span
                              key={idx}
                              style={{ height: `${heightPercent}%` }}
                              className={`flex-1 rounded-full transition-colors duration-150 ${
                                isActive ? 'bg-primary' : 'bg-surface-container-highest'
                              }`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 1:1 Bottom Tool Bar from AddEntry.jsx */}
              <div className="mt-lg flex items-center justify-between border-t border-surface-container pt-md">
                <div className="flex items-center gap-md">
                  <span className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container">
                    <span className="material-symbols-outlined text-[20px]">image</span>
                  </span>
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-container text-primary">
                    <span className="material-symbols-outlined text-[20px]">mic</span>
                  </span>
                </div>
              </div>
            </div>

            {/* 1:1 AddEntry Section: Hide from Friends Switch Card */}
            <div className="flex items-center justify-between rounded-xl lg:rounded-xxl bg-surface-container-lowest p-lg shadow-card border border-outline-variant/20">
              <div className="flex items-center gap-md">
                <span className="material-symbols-outlined text-[24px] text-on-surface-variant">
                  {heroIsHidden ? 'lock' : 'public'}
                </span>
                <div>
                  <span className="block text-body-md font-bold text-on-surface">
                    {t('addEntry.hideFromFriends')}
                  </span>
                  <span className="block text-body-sm text-on-surface-variant">
                    {t('addEntry.hideDescription')}
                  </span>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={heroIsHidden}
                aria-label={t('addEntry.hideFromFriends')}
                onClick={() => setHeroIsHidden(!heroIsHidden)}
                className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full p-1 transition-colors duration-normal focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  heroIsHidden ? 'bg-primary' : 'bg-surface-container-highest'
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full bg-surface-container-lowest shadow-subtle transition-transform duration-normal ${
                    heroIsHidden ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 1:1 Save Button from AddEntry.jsx */}
            <Link
              to="/login"
              className="flex h-14 w-full items-center justify-center rounded-full bg-primary text-label-lg font-bold text-on-primary shadow-card hover:opacity-95 active:scale-[0.99] transition-all duration-normal"
            >
              {t('addEntry.saveEntry')}
            </Link>
          </div>
        </div>
      </section>

      {/* F1 BENTO GRID FEATURES SECTION */}
      <section id="features" className="py-20 px-container-margin max-w-6xl mx-auto w-full scroll-mt-24">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <h2
            className="font-display text-3xl sm:text-4xl font-normal tracking-tight text-on-surface mb-4"
            style={{ overflowWrap: 'anywhere', minWidth: 0 }}
          >
            {t('landing.bentoHeader')}
          </h2>
          <p className="text-body-lg text-on-surface-variant leading-relaxed">
            {t('landing.bentoSubheader')}
          </p>
        </div>

        {/* 6-Tile Asymmetric Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Tile 1: 1:1 Two-Tier Friend Privacy Modal (Span 2x2: md:col-span-7 md:row-span-2) */}
          <div className="md:col-span-7 rounded-2xl bg-surface-container-lowest dark:bg-surface-container p-7 border border-outline-variant/30 shadow-card flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-sm mb-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-primary">
                  <span className="material-symbols-outlined text-[22px]">visibility_off</span>
                </div>
                <div>
                  <h3 className="text-headline-lg-mobile font-semibold text-on-surface">
                    {t('friendPrivacy.title')}
                  </h3>
                  <p className="text-body-sm text-on-surface-variant">
                    {t('friendPrivacy.subtitle')}
                  </p>
                </div>
              </div>
              <p className="text-body-sm text-on-surface-variant mb-6 leading-relaxed">
                {t('friendPrivacy.description')}
              </p>
            </div>

            {/* 1:1 Friend Privacy Rows from FriendPrivacyModal.jsx */}
            <div className="space-y-sm">
              {friendsPrivacy.map((friend) => (
                <div
                  key={friend.id}
                  className="flex items-center justify-between gap-sm rounded-2xl bg-surface-container-low p-sm transition-colors hover:bg-surface-container"
                >
                  <div className="flex items-center gap-sm min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-container font-semibold text-secondary text-body-sm">
                      {friend.initial}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-body-md font-semibold text-on-surface">
                        {friend.name}
                      </p>
                      <p className="truncate text-label-sm text-on-surface-variant">
                        @{friend.username}
                      </p>
                    </div>
                  </div>

                  {/* 1:1 Toggle Switch with lock/public icon from FriendPrivacyModal.jsx */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={friend.hidden}
                    aria-label={`Toggle privacy for ${friend.name}`}
                    onClick={() => toggleFriendPrivacy(friend.id)}
                    className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full p-1 transition-colors duration-normal focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      friend.hidden ? 'bg-primary' : 'bg-surface-container-highest'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full bg-surface-container-lowest shadow-subtle transition-transform duration-normal ${
                        friend.hidden ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px] text-on-surface">
                        {friend.hidden ? 'lock' : 'public'}
                      </span>
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Tile 2: 1:1 Voice Note Player (Span 1x1: md:col-span-5) */}
          <div className="md:col-span-5 rounded-2xl bg-surface-container-lowest dark:bg-surface-container p-7 border border-outline-variant/30 shadow-card flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-tertiary-container text-on-tertiary-container flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-[22px]">mic</span>
              </div>
              <h3 className="font-display text-2xl font-normal text-on-surface mb-2">
                {t('landing.audioMemoTitle')}
              </h3>
              <p className="text-body-md text-on-surface-variant leading-relaxed mb-6">
                {t('landing.audioMemoDesc')}
              </p>
            </div>

            {/* 1:1 VoiceNotePlayer component structure */}
            <div className="relative flex flex-col gap-xs rounded-[20px] bg-surface-container-low p-md border border-surface-container-high/60 cloud-shadow">
              <div className="flex items-center gap-md">
                <button
                  type="button"
                  onClick={() => setTileAudioPlaying(!tileAudioPlaying)}
                  aria-label={tileAudioPlaying ? 'Pause voice note' : 'Play voice note'}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary shadow-sm transition-transform active:scale-95 hover:bg-primary/90"
                >
                  <span className="material-symbols-outlined text-[24px]">
                    {tileAudioPlaying ? 'pause' : 'play_arrow'}
                  </span>
                </button>

                <div className="flex flex-1 flex-col gap-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="text-label-sm font-medium text-on-surface-variant font-sans tabular-nums min-w-0 truncate">
                      {tileAudioPlaying ? '0:28 / 1:12' : '0:00 / 1:12'}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setTileAudioSpeed((s) => (s === 1 ? 1.5 : s === 1.5 ? 2 : 1))
                      }
                      title="Playback speed"
                      className="shrink-0 rounded-md bg-surface-container px-1.5 py-0.5 text-[11px] font-semibold text-primary hover:bg-surface-container-high"
                    >
                      {tileAudioSpeed}x
                    </button>
                  </div>

                  <div
                    className="flex h-7 w-full items-center gap-[3px] py-1 cursor-pointer"
                    role="slider"
                    aria-label="Audio progress"
                    aria-valuenow={tileAudioPlaying ? 28 : 0}
                    aria-valuemin={0}
                    aria-valuemax={72}
                  >
                    {WAVEFORM_HEIGHTS.map((heightPercent, idx) => {
                      const isActive = tileAudioPlaying && idx <= 18;
                      return (
                        <span
                          key={idx}
                          style={{ height: `${heightPercent}%` }}
                          className={`flex-1 rounded-full transition-colors duration-150 ${
                            isActive ? 'bg-primary' : 'bg-surface-container-highest'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tile 3: 1:1 FeedCard Component (Span 1x1: md:col-span-5) */}
          <div className="md:col-span-5 rounded-2xl bg-surface-container-lowest dark:bg-surface-container p-7 border border-outline-variant/30 shadow-card flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-[22px]">favorite</span>
              </div>
              <h3 className="font-display text-2xl font-normal text-on-surface mb-2">
                {t('landing.noAlgorithmTitle')}
              </h3>
              <p className="text-body-md text-on-surface-variant leading-relaxed mb-6">
                {t('landing.noAlgorithmDesc')}
              </p>
            </div>

            {/* 1:1 FeedCard from pages/Feed.jsx */}
            <article className="rounded-xl lg:rounded-2xl bg-surface-container-low border border-outline-variant/20 p-md shadow-card">
              <header className="flex items-center gap-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-container font-semibold text-secondary text-body-sm">
                  D
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-body-md font-semibold text-on-surface">
                    Daniel Kim
                  </h4>
                  <p className="text-label-sm text-on-surface-variant">
                    @daniel · {isRu ? '2 ч назад' : '2h ago'}
                  </p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-mood-good-container">
                  <MoodIcon mood={4} className="text-[22px]" />
                </span>
              </header>

              <div className="mt-sm space-y-xs">
                <div className="flex flex-wrap gap-xs">
                  <span className="rounded-full px-sm py-xs text-label-sm font-semibold bg-mood-good-container text-on-mood-good-container">
                    {t('moods.4', 'Good')}
                  </span>
                  <span className="rounded-full bg-surface-container px-sm py-xs text-label-sm text-on-surface-variant">
                    #{getLocalizedTag('Calm', t)}
                  </span>
                  <span className="rounded-full bg-surface-container px-sm py-xs text-label-sm text-on-surface-variant">
                    #{getLocalizedTag('Tea', t)}
                  </span>
                </div>
                <p className="text-body-sm leading-5 text-on-surface font-serif italic">
                  “{isRu ? 'Тихий вечер с травяным чаем и спокойной музыкой. Замечательный день.' : 'Quiet evening with herbal tea and slow music. Taking things slow today.'}”
                </p>
              </div>

              <footer className="relative mt-sm border-t border-outline-variant/20 pt-sm flex items-center justify-between">
                <div className="flex items-center gap-xs">
                  <button
                    type="button"
                    onClick={() => setFeedLiked((prev) => !prev)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-label-sm font-semibold transition-all ${
                      feedLiked
                        ? 'bg-primary-container text-on-primary-container ring-1 ring-primary/40'
                        : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    <span>❤️</span>
                    <span className="tabular-nums">{feedLiked ? 4 : 3}</span>
                  </button>
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container text-label-sm text-on-surface-variant">
                    <span>🌿</span>
                    <span className="tabular-nums">2</span>
                  </span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
                    <span className="material-symbols-outlined text-[16px]">add_reaction</span>
                  </span>
                </div>
                <div className="flex items-center gap-1 text-label-sm text-on-surface-variant font-medium">
                  <span className="material-symbols-outlined text-[16px]">chat_bubble_outline</span>
                  <span>2</span>
                </div>
              </footer>
            </article>
          </div>

          {/* Tile 4: 1:1 Calendar Grid & Month Summary Cards (Span 2x1: md:col-span-7) */}
          <div className="md:col-span-7 rounded-2xl bg-surface-container-lowest dark:bg-surface-container p-7 border border-outline-variant/30 shadow-card flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-container/70 text-on-primary-container text-label-sm font-semibold">
                  <span className="material-symbols-outlined text-[16px]">calendar_month</span>
                  <span>{t('landing.calendarMatrixTitle')}</span>
                </span>
                <span className="text-label-sm font-semibold text-primary">
                  {t('landing.calendarDominant')}
                </span>
              </div>

              <h3 className="font-display text-2xl font-normal text-on-surface mb-2">
                {isRu ? 'Месяц как на ладони' : 'Your Month at a Glance'}
              </h3>
              <p className="text-body-md text-on-surface-variant leading-relaxed mb-5">
                {t('landing.calendarMatrixDesc')}
              </p>
            </div>

            {/* 1:1 Month Grid from pages/Calendar.jsx */}
            <div className="rounded-xl bg-surface-container/60 p-4 border border-outline-variant/20">
              <div className="grid grid-cols-7 text-center select-none mb-2">
                {(isRu ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S']).map((day) => (
                  <span key={day} className="pb-sm text-label-sm font-bold text-on-surface-variant/70">
                    {day}
                  </span>
                ))}
                {CALENDAR_DAYS.map((d) => {
                  const m = MOODS[d.mood];
                  const isSelected = selectedCalendarDay === d.day;
                  return (
                    <button
                      key={d.day}
                      type="button"
                      onClick={() => setSelectedCalendarDay(d.day)}
                      aria-label={`Day ${d.day}, mood ${m.label}`}
                      className="flex flex-col items-center gap-1 py-1 group focus:outline-none"
                    >
                      <span className={`text-[11px] font-medium tabular-nums flex items-center gap-0.5 ${isSelected ? 'font-bold text-primary' : 'text-on-surface/90'}`}>
                        {d.day}
                        {d.isHidden && <span className="material-symbols-outlined text-[12px] text-on-surface-variant">lock</span>}
                        {d.hasCustom && <span className="material-symbols-outlined text-[12px] text-primary">group</span>}
                      </span>
                      <span
                        className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full transition-transform group-hover:-translate-y-0.5 ${m.bg} ${
                          isSelected ? 'ring-2 ring-primary ring-offset-1 ring-offset-surface-container' : ''
                        }`}
                      >
                        <MoodIcon mood={d.mood} className="text-[18px] sm:text-[20px]" />
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* 1:1 Summary Cards from pages/Calendar.jsx lines 516-548 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm pt-md border-t border-outline-variant/15">
                <div className="flex items-center gap-sm rounded-xl bg-surface-container-low p-sm border border-outline-variant/10">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mood-rad-container text-on-mood-rad-container">
                    <MoodIcon mood={5} className="text-[22px]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-overline text-on-surface-variant/70">{t('calendar.dominantMood')}</p>
                    <p className="text-body-md font-bold text-on-surface truncate">{t('moods.5', 'Rad')}</p>
                  </div>
                </div>

                <div className="flex items-center gap-sm rounded-xl bg-surface-container-low p-sm border border-outline-variant/10">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container/40 text-primary">
                    <span className="material-symbols-outlined text-[20px]">tag</span>
                  </span>
                  <div className="min-w-0">
                    <p className="text-overline text-on-surface-variant/70">{t('calendar.topTag')}</p>
                    <p className="text-body-md font-bold text-on-surface truncate">#{getLocalizedTag('Calm', t)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tile 5: 1:1 Stats.jsx Mood Distribution & Insights (Span 1x1: md:col-span-6) */}
          <div className="md:col-span-6 rounded-2xl bg-surface-container-lowest dark:bg-surface-container p-7 border border-outline-variant/30 shadow-card flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-[22px]">pie_chart</span>
              </div>
              <h3 className="font-display text-2xl font-normal text-on-surface mb-2">
                {t('landing.analyticsTitle')}
              </h3>
              <p className="text-body-md text-on-surface-variant leading-relaxed mb-6">
                {t('landing.analyticsDesc')}
              </p>
            </div>

            {/* 1:1 Distribution Bars from pages/Stats.jsx lines 177-209 */}
            <div className="space-y-sm p-4 rounded-xl bg-surface-container/60 border border-outline-variant/20">
              {[
                { level: 5, pct: 45, count: 12, color: 'bg-mood-rad' },
                { level: 4, pct: 33, count: 9, color: 'bg-mood-good' },
                { level: 3, pct: 14, count: 4, color: 'bg-mood-meh' },
                { level: 2, pct: 5, count: 1, color: 'bg-mood-bad' },
                { level: 1, pct: 3, count: 1, color: 'bg-mood-awful' },
              ].map((item) => {
                const moodInfo = getMoodInfo(item.level, t);
                return (
                  <div key={item.level} className="flex items-center gap-sm">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${moodInfo.bg}`}>
                      <MoodIcon mood={item.level} className="text-[16px]" />
                    </span>
                    <div className="w-16 text-body-sm font-medium text-on-surface truncate">
                      {moodInfo.label}
                    </div>
                    <div className="flex-1 h-2.5 rounded-full bg-surface-container-low overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.color}`}
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                    <span className="w-16 text-right text-label-sm font-bold text-on-surface-variant tabular-nums">
                      {item.pct}% ({item.count})
                    </span>
                  </div>
                );
              })}

              {/* 1:1 Insight Card from pages/Stats.jsx lines 150-162 */}
              <div className="flex items-start gap-md rounded-xl bg-surface-container-low border border-outline-variant/15 p-3 shadow-subtle mt-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-mood-rad-container text-on-mood-rad-container mt-0.5">
                  <span className="material-symbols-outlined text-[16px]">trending_up</span>
                </span>
                <p className="text-body-sm font-medium text-on-surface leading-snug">
                  {isRu
                    ? 'Ваше настроение обычно выше по пятницам и субботам.'
                    : 'Your mood tends to be highest on Fridays and Saturdays.'}
                </p>
              </div>
            </div>
          </div>

          {/* Tile 6: 1:1 BottomNav.jsx Mobile PWA Preview (Span 1x1: md:col-span-6) */}
          <div className="md:col-span-6 rounded-2xl bg-surface-container-lowest dark:bg-surface-container p-7 border border-outline-variant/30 shadow-card flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-surface-container-highest text-on-surface flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-[22px]">vibration</span>
              </div>
              <h3 className="font-display text-2xl font-normal text-on-surface mb-2">
                {t('landing.pwaTitle')}
              </h3>
              <p className="text-body-md text-on-surface-variant leading-relaxed mb-6">
                {t('landing.pwaDesc')}
              </p>
            </div>

            {/* 1:1 BottomNav from components/BottomNav.jsx */}
            <div className="p-4 rounded-xl bg-surface-container/60 border border-outline-variant/20 flex flex-col items-center gap-4">
              <nav
                aria-label="App Navigation Preview"
                className="w-full flex items-center justify-around rounded-full bg-surface/90 border border-outline-variant/30 px-3 py-2 shadow-floating backdrop-blur-xl select-none"
              >
                {[
                  { icon: 'home', labelKey: 'nav.home', active: true },
                  { icon: 'calendar_today', labelKey: 'nav.calendar' },
                  { icon: 'add', labelKey: 'nav.addEntry', isAdd: true },
                  { icon: 'grid_view', labelKey: 'nav.feed' },
                  { icon: 'person', labelKey: 'nav.profile' },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-center rounded-full transition-all ${
                      item.isAdd
                        ? 'h-12 w-12 bg-primary text-on-primary shadow-card'
                        : item.active
                        ? 'h-11 w-11 bg-primary-container text-on-primary-container font-semibold'
                        : 'h-11 w-11 text-on-surface-variant'
                    }`}
                  >
                    <span
                      className="material-symbols-outlined text-[22px]"
                      style={item.active ? { fontVariationSettings: "'FILL' 1" } : undefined}
                    >
                      {item.icon}
                    </span>
                  </div>
                ))}
              </nav>

              <div className="flex items-center gap-2 text-label-sm font-semibold text-on-surface">
                <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                <span>{isRu ? 'iPhone и Android · Приятный виброотклик' : 'iPhone & Android · Gentle Haptics'}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PHILOSOPHY STATEMENT & HONEST COMPARISON */}
      <section id="philosophy" className="py-20 px-container-margin max-w-5xl mx-auto w-full scroll-mt-24">
        {/* T3 Single Huge Quote */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="font-display text-2xl sm:text-3xl lg:text-4xl font-normal text-on-surface leading-tight tracking-tight mb-6">
            “{t('landing.quoteStatement')}”
          </p>
          <div className="w-16 h-0.5 bg-primary/40 mx-auto" />
        </div>

        {/* Side-by-Side Honest Comparison */}
        <div className="rounded-2xl bg-surface-container-lowest dark:bg-surface-container border border-outline-variant/30 shadow-card overflow-hidden">
          <div className="p-6 border-b border-outline-variant/20 text-center sm:text-left">
            <h3 className="font-display text-2xl font-normal text-on-surface">
              {t('landing.comparisonTitle')}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-outline-variant/20">
            {/* Column 1: Typical Social Media */}
            <div className="p-6 sm:p-8 space-y-6 bg-surface-container-low/40 dark:bg-surface-container-low/20">
              <div className="flex items-center gap-2 text-label-lg font-bold text-on-surface-variant">
                <span className="material-symbols-outlined text-[20px] text-error">close</span>
                <span>{t('landing.socialNetworks')}</span>
              </div>
              <ul className="space-y-4 text-body-md text-on-surface-variant">
                <li className="flex items-start gap-3">
                  <span className="text-error mt-0.5 font-bold">—</span>
                  <span>{t('landing.comp1Social')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-error mt-0.5 font-bold">—</span>
                  <span>{t('landing.comp2Social')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-error mt-0.5 font-bold">—</span>
                  <span>{t('landing.comp3Social')}</span>
                </li>
              </ul>
            </div>

            {/* Column 2: The Moodila Way */}
            <div className="p-6 sm:p-8 space-y-6 bg-surface-container-lowest dark:bg-surface-container">
              <div className="flex items-center gap-2 text-label-lg font-bold text-primary">
                <span className="material-symbols-outlined text-[20px]">check_circle</span>
                <span>{t('landing.moodilaWay')}</span>
              </div>
              <ul className="space-y-4 text-body-md text-on-surface">
                <li className="flex items-start gap-3">
                  <span className="text-primary font-bold mt-0.5">✓</span>
                  <span>{t('landing.comp1Moodila')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary font-bold mt-0.5">✓</span>
                  <span>{t('landing.comp2Moodila')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary font-bold mt-0.5">✓</span>
                  <span>{t('landing.comp3Moodila')}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS (F4 STEP SEQUENCE) */}
      <section id="how-it-works" className="py-20 px-container-margin max-w-5xl mx-auto w-full scroll-mt-24">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <h2
            className="font-display text-3xl sm:text-4xl font-normal tracking-tight text-on-surface mb-3"
            style={{ overflowWrap: 'anywhere', minWidth: 0 }}
          >
            {t('landing.howItWorksTitle')}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              num: '01',
              title: t('landing.step1Title'),
              desc: t('landing.step1Desc'),
              icon: 'edit_note',
            },
            {
              num: '02',
              title: t('landing.step2Title'),
              desc: t('landing.step2Desc'),
              icon: 'shield',
            },
            {
              num: '03',
              title: t('landing.step3Title'),
              desc: t('landing.step3Desc'),
              icon: 'forum',
            },
          ].map((step, idx) => (
            <div
              key={idx}
              className="rounded-2xl bg-surface-container-lowest dark:bg-surface-container p-7 border border-outline-variant/30 shadow-card flex flex-col justify-between relative"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <span className="font-display text-2xl font-bold text-primary font-mono">
                    {step.num}
                  </span>
                  <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">{step.icon}</span>
                  </div>
                </div>
                <h3 className="font-display text-xl font-normal text-on-surface mb-2.5">
                  {step.title}
                </h3>
                <p className="text-body-md text-on-surface-variant leading-relaxed">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CONVERSATIONAL FAQ SECTION */}
      <section id="faq" className="py-20 px-container-margin max-w-4xl mx-auto w-full scroll-mt-24">
        <div className="text-center mb-14">
          <h2
            className="font-display text-3xl sm:text-4xl font-normal tracking-tight text-on-surface mb-3"
            style={{ overflowWrap: 'anywhere', minWidth: 0 }}
          >
            {t('landing.faqTitle')}
          </h2>
          <p className="text-body-md text-on-surface-variant">
            {t('landing.faqSubtitle')}
          </p>
        </div>

        <div className="space-y-3">
          {[
            { q: t('landing.q1'), a: t('landing.a1') },
            { q: t('landing.q2'), a: t('landing.a2') },
            { q: t('landing.q3'), a: t('landing.a3') },
            { q: t('landing.q4'), a: t('landing.a4') },
            { q: t('landing.q5'), a: t('landing.a5') },
          ].map((item, index) => {
            const isOpen = openFaq === index;
            return (
              <div
                key={index}
                className="rounded-xl bg-surface-container-lowest dark:bg-surface-container border border-outline-variant/30 shadow-subtle overflow-hidden transition-all duration-200"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? -1 : index)}
                  aria-expanded={isOpen}
                  className="w-full p-5 text-left flex items-center justify-between text-body-lg font-semibold text-on-surface hover:bg-surface-container-high/40 transition-colors focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <span className="pr-4">{item.q}</span>
                  <span className="text-xl font-mono text-on-surface-variant shrink-0">
                    {isOpen ? '−' : '+'}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-body-md text-on-surface-variant leading-relaxed border-t border-outline-variant/10">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* FT5 STATEMENT CLOSER & FOOTER */}
      <footer className="pt-20 pb-12 px-container-margin border-t border-outline-variant/30 bg-surface-container-low/60 dark:bg-surface-container-lowest text-on-surface-variant text-body-sm">
        <div className="max-w-5xl mx-auto">
          {/* Ft5 Statement Headline */}
          <div className="mb-16 text-center sm:text-left">
            <p
              className="font-display text-3xl sm:text-4xl lg:text-5xl font-normal text-on-surface leading-tight tracking-tight max-w-2xl mb-8"
              style={{ overflowWrap: 'anywhere', minWidth: 0 }}
            >
              {t('landing.footerStatement')}
            </p>
            <Link
              to="/login"
              className="h-12 px-7 inline-flex items-center justify-center gap-2 rounded-full bg-primary text-on-primary text-label-lg font-semibold hover:shadow-card hover:-translate-y-0.5 active:translate-y-0 active:scale-98 transition-all focus-visible:outline-2 focus-visible:outline-primary whitespace-nowrap"
            >
              <span>{t('landing.footerCta')}</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </Link>
          </div>

          {/* Bottom Meta Row */}
          <div className="pt-8 border-t border-outline-variant/20 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3 font-display text-lg text-on-surface font-semibold">
              <AppLogo className="w-6 h-6 rounded-md" />
              <span>Moodila</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-label-sm">
              <Link to="/login" className="hover:text-on-surface transition-colors whitespace-nowrap">
                {t('landing.navLogIn')}
              </Link>
              <a href="#features" className="hover:text-on-surface transition-colors whitespace-nowrap">
                {t('landing.navFeatures')}
              </a>
              <a href="#philosophy" className="hover:text-on-surface transition-colors whitespace-nowrap">
                {t('landing.navPhilosophy')}
              </a>
              <a href="#faq" className="hover:text-on-surface transition-colors whitespace-nowrap">
                {t('landing.navFaq')}
              </a>
            </div>

            <p className="text-label-sm text-on-surface-variant/80">
              © {new Date().getFullYear()} {t('landing.footerRights')}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
