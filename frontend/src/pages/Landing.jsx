import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

// Mood definitions matching utils/moods.js 1:1
const APP_MOODS = {
  5: { value: 5, icon: 'sentiment_very_satisfied', label: 'Great', color: 'text-tertiary', bg: 'bg-tertiary-container/40' },
  4: { value: 4, icon: 'sentiment_satisfied', label: 'Good', color: 'text-primary', bg: 'bg-primary-container/30' },
  3: { value: 3, icon: 'sentiment_neutral', label: 'Okay', color: 'text-secondary', bg: 'bg-secondary-container/30' },
  2: { value: 2, icon: 'sentiment_dissatisfied', label: 'Low', color: 'text-amber-600', bg: 'bg-amber-500/20' },
  1: { value: 1, icon: 'sentiment_very_dissatisfied', label: 'Rough', color: 'text-error', bg: 'bg-error-container/30' },
}

// Category tags matching AddEntry.jsx 1:1
const TAG_CATEGORIES = [
  {
    key: 'positive',
    label: 'Positive',
    tags: ['Calm', 'Chill', 'Motivated', 'Grateful', 'Inspired', 'Peaceful'],
  },
  {
    key: 'neutral',
    label: 'Neutral',
    tags: ['Okay', 'Neutral', 'Bored', 'Focused', 'Steady', 'Meh'],
  },
  {
    key: 'difficult',
    label: 'Difficult',
    tags: ['Tired', 'Anxious', 'Overwhelmed', 'Frustrated', 'Lonely', 'Drained'],
  },
]

const SHARED_ENTRY_TEXT = 'Quiet evening with warm tea. So glad to unwind.'

const FAQS = [
  {
    q: 'How is MoodShare different from typical social media?',
    a: 'MoodShare isn’t built for clout or viral loops. There are no public follower counts, ads, or algorithmic feeds. It’s a quiet personal diary with an optional private space for your real friends.',
  },
  {
    q: 'Can I keep my entries completely private from friends?',
    a: 'Yes! Every entry has a "Hide Entry" option. When hidden, only you can see it in your personal calendar and summary.',
  },
  {
    q: 'Is MoodShare free to use?',
    a: 'Yes, MoodShare is completely free for personal mood tracking, friend feeds, and monthly analytics.',
  },
  {
    q: 'Can I install MoodShare as an app on my phone?',
    a: 'Absolutely! MoodShare is built as a Progressive Web App (PWA). You can tap "Add to Home Screen" on iOS or Android to use it just like a native app.',
  },
]

// Mock Calendar Entries mapping 1:1 to original app calendar
const MOCK_CALENDAR_ENTRIES = {
  2: { mood: 1, note: 'Tough start to the week, stayed in bed early.', tags: ['Tired'] },
  4: { mood: 2, note: 'Felt quite anxious about deadlines.', tags: ['Anxious'] },
  5: { mood: 4, note: 'Nice afternoon coffee break with tea.', tags: ['Chill'] },
  8: { mood: 4, note: 'Productive workout and sunny weather.', tags: ['Inspired', 'Grateful'] },
  9: { mood: 2, note: 'Low energy day.', tags: ['Tired'] },
  10: { mood: 3, note: 'Routine Monday, steady work.', tags: ['Focused'] },
  12: { mood: 1, note: 'Overwhelmed with tasks.', tags: ['Overwhelmed'] },
  13: { mood: 4, note: 'Felt much better after chatting with a friend.', tags: ['Calm', 'Peaceful'] },
  14: { mood: 2, note: 'Felt rainy and quiet.', tags: ['Meh'] },
  15: { mood: 5, note: 'Had an inspiring session with the team!', tags: ['Motivated'] },
  17: { mood: 1, note: 'Felt emotionally drained.', tags: ['Drained'] },
  18: { mood: 4, note: 'Took a long evening walk.', tags: ['Calm'] },
  19: { mood: 2, note: 'Trouble focusing today.', tags: ['Bored'] },
  20: { mood: 4, note: 'Cooked a warm dinner.', tags: ['Peaceful'] },
  22: { mood: 1, note: 'Hard day, self-care night.', tags: ['Tired'] },
  24: { mood: 2, note: 'Slight headache, rested early.', tags: ['Meh'] },
  26: { mood: 4, note: 'Finished a great book!', tags: ['Inspired'] },
  27: { mood: 1, note: 'Felt frustrated.', tags: ['Frustrated'] },
  29: { mood: 2, note: 'Restless evening.', tags: ['Okay'] },
  30: { mood: 5, note: 'Wonderful weekend getaway!', tags: ['Grateful'] },
}

export default function Landing() {
  const [activeTab, setActiveTab] = useState('home')
  const [openFaq, setOpenFaq] = useState(null)

  // Closed loop signature animation state
  const [hasLiked, setHasLiked] = useState(false)
  const loopSectionRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const timer = setTimeout(() => {
            setHasLiked(true)
          }, 700)
          return () => clearTimeout(timer)
        }
      },
      { threshold: 0.35 }
    )

    if (loopSectionRef.current) {
      observer.observe(loopSectionRef.current)
    }

    return () => observer.disconnect()
  }, [])

  // Demo Calendar interactive states
  const [calViewMode, setCalViewMode] = useState('month')
  const [selectedDay, setSelectedDay] = useState(15)

  // 1:1 Live Interactive Demo State for "Record your day" (AddEntry)
  const [demoMood, setDemoMood] = useState(4) // Default: 4 (Good)
  const [demoTags, setDemoTags] = useState(['Grateful', 'Calm'])
  const [demoText, setDemoText] = useState('Finished reading a chapter by the window with a warm cup of tea.')
  const [demoIsHidden, setDemoIsHidden] = useState(false)
  const [demoSaveNotice, setDemoSaveNotice] = useState(false)

  const toggleDemoTag = (tag) => {
    setDemoTags((curr) =>
      curr.includes(tag) ? curr.filter((t) => t !== tag) : [...curr, tag]
    )
  }

  const handleDemoSave = (e) => {
    e.preventDefault()
    setDemoSaveNotice(true)
    setTimeout(() => setDemoSaveNotice(false), 3000)
  }

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col font-sans transition-colors duration-300">
      {/* HEADER / NAVIGATION */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-outline-variant/30 px-container-margin py-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/landing" className="flex items-center gap-xs text-headline-lg font-bold text-on-surface">
            <span className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-xl cloud-shadow">
              🌸
            </span>
            <span className="tracking-tight">MoodShare</span>
          </Link>

          <nav className="hidden md:flex items-center gap-lg text-label-lg font-medium text-on-surface-variant">
            <a href="#demo" className="hover:text-primary transition-colors">
              Interactive Demo
            </a>
            <a href="#features" className="hover:text-primary transition-colors">
              Features
            </a>
            <a href="#showcase" className="hover:text-primary transition-colors">
              App Showcase
            </a>
            <a href="#faq" className="hover:text-primary transition-colors">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-xs">
            <Link
              to="/login"
              className="px-md py-xs rounded-full text-label-lg font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
            >
              Log in
            </Link>
            <Link
              to="/login"
              className="px-md py-xs rounded-full bg-primary-container text-on-primary-container text-label-lg font-semibold hover:opacity-90 transition-opacity shadow-sm"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative px-container-margin pt-xl pb-20 overflow-hidden">
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-r from-primary-container/40 via-secondary-container/40 to-tertiary-container/40 blur-3xl pointer-events-none -z-10 rounded-full" />

        <div className="max-w-5xl mx-auto text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-xs px-md py-xs rounded-full bg-surface-container-high text-on-surface-variant text-label-sm font-semibold mb-lg cloud-shadow">
            <span>✨</span>
            <span>Your Digital Sanctuary for Mindful Living</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-on-surface max-w-3xl leading-tight">
            Track your mood. <br className="hidden sm:inline" />
            Share your world. <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-primary via-secondary to-tertiary bg-clip-text text-transparent">
              Connect with care.
            </span>
          </h1>

          <p className="mt-md text-body-md md:text-lg text-on-surface-variant max-w-2xl leading-relaxed">
            MoodShare is your gentle daily journal with a warm, private social circle. Log your feelings, discover emotional trends, and keep close with friends without algorithmic noise.
          </p>

          <div className="mt-lg flex flex-wrap items-center justify-center gap-md">
            <Link
              to="/login"
              className="px-xl py-md rounded-full bg-primary-container text-on-primary-container text-label-lg font-bold hover:shadow-lg transition-all transform hover:-translate-y-0.5"
            >
              Start Journaling — Free
            </Link>
            <a
              href="#demo"
              className="px-xl py-md rounded-full bg-surface-container text-on-surface text-label-lg font-semibold hover:bg-surface-container-high transition-colors"
            >
              Try Interactive Demo
            </a>
          </div>

          <div className="mt-xl flex flex-wrap justify-center items-center gap-md text-body-sm text-on-surface-variant">
            <span className="flex items-center gap-xs">✓ 30-Second Daily Check-in</span>
            <span className="flex items-center gap-xs">✓ 100% Private Entries</span>
            <span className="flex items-center gap-xs">✓ iOS & Android PWA</span>
          </div>
        </div>
      </section>

      {/* 1:1 INTERACTIVE DEMO WIDGET (EXACT ADAPTATION OF "Record your day" / AddEntry.jsx) */}
      <section id="demo" className="px-container-margin py-xl bg-surface-container-low/60 border-y border-outline-variant/20">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-lg">
            <span className="px-md py-xs rounded-full bg-primary-container text-on-primary-container text-label-sm font-semibold">
              Live Interactive Form Demo
            </span>
            <h2 className="mt-xs text-headline-lg font-bold text-on-surface">Try "Record your day" Live</h2>
            <p className="mt-xs text-body-md text-on-surface-variant">
              This interactive widget matches MoodShare’s exact entry creation interface 1:1.
            </p>
          </div>

          {/* 1:1 AddEntry Form Mockup Container */}
          <div className="rounded-[32px] bg-background p-md sm:p-lg border border-outline-variant/30 cloud-shadow space-y-md text-left">
            <div className="flex items-center justify-between pb-xs border-b border-surface-container">
              <span className="text-headline-lg-mobile font-headline-lg-mobile font-bold text-on-surface">Record your day</span>
              <span className="px-sm py-1 rounded-full bg-surface-container text-label-sm text-on-surface-variant font-medium">
                Today
              </span>
            </div>

            {/* Mood Selector Card (1:1 with AddEntry.jsx) */}
            <section className="rounded-[24px] bg-white p-lg cloud-shadow">
              <h3 className="mb-md text-label-lg font-label-lg text-on-surface-variant">
                How are you feeling today?
              </h3>

              {/* Mood Buttons Row */}
              <div className="mb-lg flex items-center justify-between">
                {[1, 2, 3, 4, 5].map((val) => {
                  const item = APP_MOODS[val]
                  const isSelected = demoMood === val
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setDemoMood(val)}
                      className={`flex h-12 w-12 items-center justify-center rounded-full transition-all active:scale-95 ${item.bg} ${
                        isSelected ? 'ring-4 ring-primary/40 scale-110 shadow-md' : 'opacity-80 hover:opacity-100'
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-[28px] ${item.color}`}
                        style={{ fontVariationSettings: isSelected ? "'FILL' 1" : undefined }}
                      >
                        {item.icon}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Selected Mood Badge Indicator */}
              <div className="flex items-center justify-center pb-xs">
                <span className={`px-md py-xs rounded-full text-label-lg font-bold ${APP_MOODS[demoMood].bg} ${APP_MOODS[demoMood].color}`}>
                  Feeling {APP_MOODS[demoMood].label}
                </span>
              </div>

              {/* Categorized Tag Chips (1:1 with AddEntry.jsx) */}
              <div className="space-y-sm border-t border-surface-container pt-md">
                {TAG_CATEGORIES.map((category) => (
                  <div key={category.key}>
                    <span className="mb-xs block text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant/60">
                      {category.label}
                    </span>
                    <div className="flex flex-wrap gap-xs">
                      {category.tags.map((tag) => {
                        const selected = demoTags.includes(tag)
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleDemoTag(tag)}
                            className={`rounded-full px-md py-xs text-label-sm font-label-sm transition-colors ${
                              selected
                                ? 'bg-primary-container text-primary font-semibold shadow-xs'
                                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                            }`}
                          >
                            {tag}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Summary Textarea Card (1:1 with AddEntry.jsx) */}
            <section className="rounded-[24px] bg-white p-lg cloud-shadow">
              <label htmlFor="demo-entry-text" className="mb-md block text-label-lg font-label-lg text-on-surface-variant">
                Write a summary of your day
              </label>
              <textarea
                id="demo-entry-text"
                value={demoText}
                onChange={(e) => setDemoText(e.target.value)}
                placeholder="Start writing..."
                className="min-h-[140px] w-full resize-none bg-transparent p-0 text-body-md font-body-md text-on-surface outline-none placeholder:text-on-surface-variant/40"
              />

              {/* Attachments Toolbar */}
              <div className="mt-md flex items-center gap-md border-t border-surface-container pt-md">
                <button
                  type="button"
                  title="Add photo"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">image</span>
                </button>

                <button
                  type="button"
                  title="Record voice note"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">mic</span>
                </button>

                <button
                  type="button"
                  title="Attach file"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant opacity-60"
                >
                  <span className="material-symbols-outlined text-[20px]">attach_file</span>
                </button>
              </div>
            </section>

            {/* Privacy Switch Section (1:1 with AddEntry.jsx) */}
            <section className="flex items-center justify-between rounded-[24px] bg-white p-lg cloud-shadow">
              <div className="flex items-center gap-md">
                <span className="material-symbols-outlined text-[24px] text-on-surface-variant">
                  {demoIsHidden ? 'lock' : 'public'}
                </span>
                <div>
                  <span className="block text-body-md font-label-lg text-on-surface font-semibold">
                    Hide entry from friends
                  </span>
                  <span className="block text-body-sm text-on-surface-variant">
                    {demoIsHidden ? 'Visible only to you' : 'Visible to friends'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={demoIsHidden}
                onClick={() => setDemoIsHidden(!demoIsHidden)}
                className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full p-1 transition-colors duration-300 ${
                  demoIsHidden ? 'bg-primary' : 'bg-surface-container-highest'
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full bg-surface-container-lowest shadow-md transition-transform duration-300 ${
                    demoIsHidden ? 'translate-x-6 text-on-primary-container' : 'translate-x-0 text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {demoIsHidden ? 'lock' : 'public'}
                  </span>
                </span>
              </button>
            </section>

            {/* Save Entry Action Button */}
            <form onSubmit={handleDemoSave}>
              <button
                type="submit"
                className="w-full h-12 rounded-full bg-primary text-on-primary text-label-lg font-label-lg font-bold shadow-md hover:bg-primary/90 transition-all active:scale-[0.99]"
              >
                Save entry
              </button>
            </form>

            {/* Live Save Notification */}
            {demoSaveNotice && (
              <div className="p-md rounded-2xl bg-primary-container text-on-primary-container text-label-lg font-semibold text-center animate-in fade-in zoom-in-95">
                ✨ Your entry has been saved to your calendar!
              </div>
            )}
          </div>
        </div>
      </section>

      {/* THE CLOSED LOOP SECTION */}
      <section id="features" ref={loopSectionRef} className="px-container-margin py-20 max-w-6xl mx-auto w-full">
        {/* Header (Eyebrow + H2 + Subtitle) */}
        <div className="text-center mb-16">
          <span className="px-md py-xs rounded-full bg-secondary-container text-on-secondary-container text-label-sm font-semibold inline-block">
            Not just a journal
          </span>
          <h2 className="mt-xs text-3xl md:text-4xl font-bold text-on-surface">
            A journal that answers back
          </h2>
          <p className="mt-xs text-body-md text-on-surface-variant max-w-xl mx-auto leading-relaxed">
            Your entries are visible only to accepted friends — zero algorithms, zero public pressure, zero noise.
          </p>
        </div>

        {/* 4 Connected Nodes Container */}
        <div className="flex flex-col md:flex-row items-stretch gap-6 md:gap-0">
          
          {/* NODE 1 — "You record your day" */}
          <div className="flex-1 flex flex-col justify-between bg-white rounded-[24px] p-md lg:p-lg cloud-shadow border border-outline-variant/30 relative z-10 transition-all hover:shadow-md">
            <div>
              {/* Header inside mockup 1 */}
              <div className="flex items-center justify-between mb-sm pb-xs border-b border-surface-container">
                <span className="text-label-sm font-semibold text-on-surface-variant">My Entry</span>
                <span className="text-[11px] text-on-surface-variant/60">Today</span>
              </div>

              {/* Entry Content Mockup */}
              <div className="space-y-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-xs">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${APP_MOODS[4].bg}`}
                    >
                      <span
                        className={`material-symbols-outlined text-[18px] ${APP_MOODS[4].color}`}
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        {APP_MOODS[4].icon}
                      </span>
                    </span>
                    <span className="px-sm py-0.5 rounded-full bg-primary-container/40 text-[11px] font-semibold text-primary">
                      #Grateful
                    </span>
                  </div>

                  {/* Photo preview placeholder 32x32 */}
                  <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0 border border-outline-variant/20">
                    <span className="material-symbols-outlined text-[16px]">image</span>
                  </div>
                </div>

                <p className="text-[12px] leading-snug text-on-surface italic bg-surface-container-low/60 p-xs rounded-xl border border-outline-variant/10">
                  “{SHARED_ENTRY_TEXT}”
                </p>
              </div>
            </div>

            {/* Caption under Node 1 */}
            <div className="mt-sm pt-xs border-t border-outline-variant/15 text-center">
              <p className="text-label-md font-bold text-on-surface">You record your day</p>
            </div>
          </div>

          {/* CONNECTOR 1 -> 2 */}
          <div className="flex md:flex-col items-center justify-center shrink-0 md:w-16 lg:w-20 py-2 md:py-0 px-1 relative z-0">
            {/* Desktop Horizontal Line */}
            <div className="hidden md:flex flex-col items-center w-full">
              <span className="text-[9px] lg:text-[10px] font-medium text-on-surface-variant/80 whitespace-nowrap mb-1 px-1.5 py-0.5 rounded-full bg-surface-container-low border border-outline-variant/20">
                friends only
              </span>
              <div className="w-full flex items-center">
                <div className="h-[2px] w-full bg-outline-variant/40 border-b border-dashed border-outline-variant" />
                <span className="material-symbols-outlined text-[14px] text-outline-variant/80 -ml-1 shrink-0">
                  chevron_right
                </span>
              </div>
            </div>

            {/* Mobile Vertical Line */}
            <div className="flex md:hidden items-center gap-sm py-2">
              <div className="flex flex-col items-center">
                <div className="w-[2px] h-8 bg-outline-variant/40 border-r border-dashed border-outline-variant" />
                <span className="material-symbols-outlined text-[16px] text-outline-variant/80 -mt-1">
                  expand_more
                </span>
              </div>
              <span className="text-label-sm font-medium text-on-surface-variant/80 px-md py-xs rounded-full bg-surface-container-low border border-outline-variant/20">
                friends only
              </span>
            </div>
          </div>

          {/* NODE 2 — "Friend sees in feed" */}
          <div className="flex-1 flex flex-col justify-between bg-white rounded-[24px] p-md lg:p-lg cloud-shadow border border-outline-variant/30 relative z-10 transition-all hover:shadow-md">
            <div>
              {/* Feed Card Mockup Header */}
              <div className="flex items-center justify-between mb-sm pb-xs border-b border-surface-container">
                <div className="flex items-center gap-xs">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-container text-secondary text-label-sm font-bold">
                    D
                  </div>
                  <div>
                    <h4 className="text-label-sm font-bold text-on-surface leading-none">Daniel Kim</h4>
                    <span className="text-[10px] text-on-surface-variant">10m ago</span>
                  </div>
                </div>
                <span
                  className={`material-symbols-outlined text-[20px] ${APP_MOODS[4].color}`}
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {APP_MOODS[4].icon}
                </span>
              </div>

              {/* Feed Card Text (Exact same entry text as Node 1!) */}
              <p className="text-[12px] leading-snug text-on-surface italic bg-surface-container-low/60 p-xs rounded-xl border border-outline-variant/10">
                “{SHARED_ENTRY_TEXT}”
              </p>
            </div>

            {/* Caption under Node 2 */}
            <div className="mt-sm pt-xs border-t border-outline-variant/15 text-center">
              <p className="text-label-md font-bold text-on-surface">Friend sees in feed</p>
            </div>
          </div>

          {/* CONNECTOR 2 -> 3 */}
          <div className="flex md:flex-col items-center justify-center shrink-0 md:w-16 lg:w-20 py-2 md:py-0 px-1 relative z-0">
            {/* Desktop Horizontal Line */}
            <div className="hidden md:flex flex-col items-center w-full">
              <span className="text-[9px] lg:text-[10px] font-medium text-on-surface-variant/80 whitespace-nowrap mb-1 px-1.5 py-0.5 rounded-full bg-surface-container-low border border-outline-variant/20">
                friend reacts
              </span>
              <div className="w-full flex items-center">
                <div className="h-[2px] w-full bg-outline-variant/40 border-b border-dashed border-outline-variant" />
                <span className="material-symbols-outlined text-[14px] text-outline-variant/80 -ml-1 shrink-0">
                  chevron_right
                </span>
              </div>
            </div>

            {/* Mobile Vertical Line */}
            <div className="flex md:hidden items-center gap-sm py-2">
              <div className="flex flex-col items-center">
                <div className="w-[2px] h-8 bg-outline-variant/40 border-r border-dashed border-outline-variant" />
                <span className="material-symbols-outlined text-[16px] text-outline-variant/80 -mt-1">
                  expand_more
                </span>
              </div>
              <span className="text-label-sm font-medium text-on-surface-variant/80 px-md py-xs rounded-full bg-surface-container-low border border-outline-variant/20">
                friend reacts
              </span>
            </div>
          </div>

          {/* NODE 3 — "Friend leaves a like" */}
          <div className="flex-1 flex flex-col justify-between bg-white rounded-[24px] p-md lg:p-lg cloud-shadow border border-outline-variant/30 relative z-10 transition-all hover:shadow-md">
            <div>
              <div className="flex items-center justify-between mb-sm pb-xs border-b border-surface-container">
                <span className="text-label-sm font-semibold text-on-surface-variant">Reaction</span>
                <span className="text-[11px] text-on-surface-variant/60">Feed</span>
              </div>

              {/* Heart reaction mockup */}
              <div className="flex flex-col items-center justify-center py-xs space-y-xs bg-primary-container/20 rounded-xl border border-primary-container/30">
                <div className={`transition-transform duration-300 ${hasLiked ? 'scale-125' : 'scale-100'}`}>
                  <span
                    className="material-symbols-outlined text-[28px] text-primary"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    favorite
                  </span>
                </div>
                <div className="text-label-md font-bold text-primary transition-all duration-300">
                  {hasLiked ? '4 Likes' : '3 Likes'}
                </div>
              </div>
            </div>

            {/* Caption under Node 3 */}
            <div className="mt-sm pt-xs border-t border-outline-variant/15 text-center">
              <p className="text-label-md font-bold text-on-surface">Friend leaves a like</p>
            </div>
          </div>

          {/* CONNECTOR 3 -> 4 */}
          <div className="flex md:flex-col items-center justify-center shrink-0 md:w-16 lg:w-20 py-2 md:py-0 px-1 relative z-0">
            {/* Desktop Horizontal Line */}
            <div className="hidden md:flex flex-col items-center w-full">
              <span className="text-[9px] lg:text-[10px] font-medium text-on-surface-variant/80 whitespace-nowrap mb-1 px-1.5 py-0.5 rounded-full bg-surface-container-low border border-outline-variant/20">
                you find out
              </span>
              <div className="w-full flex items-center">
                <div className="h-[2px] w-full bg-outline-variant/40 border-b border-dashed border-outline-variant" />
                <span className="material-symbols-outlined text-[14px] text-outline-variant/80 -ml-1 shrink-0">
                  chevron_right
                </span>
              </div>
            </div>

            {/* Mobile Vertical Line */}
            <div className="flex md:hidden items-center gap-sm py-2">
              <div className="flex flex-col items-center">
                <div className="w-[2px] h-8 bg-outline-variant/40 border-r border-dashed border-outline-variant" />
                <span className="material-symbols-outlined text-[16px] text-outline-variant/80 -mt-1">
                  expand_more
                </span>
              </div>
              <span className="text-label-sm font-medium text-on-surface-variant/80 px-md py-xs rounded-full bg-surface-container-low border border-outline-variant/20">
                you find out
              </span>
            </div>
          </div>

          {/* NODE 4 — "Notification to you" */}
          <div className="flex-1 flex flex-col justify-between bg-white rounded-[24px] p-md lg:p-lg cloud-shadow border border-outline-variant/30 relative z-10 transition-all hover:shadow-md">
            <div>
              {/* Header Bell with animated badge */}
              <div className="flex items-center justify-between mb-sm pb-xs border-b border-surface-container">
                <span className="text-label-sm font-semibold text-on-surface-variant">Notifications</span>
                
                {/* HeaderBell Icon with red badge */}
                <div className="relative flex items-center justify-center w-7 h-7 rounded-full bg-surface-container-low">
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                    notifications
                  </span>

                  {/* Red Badge "1" — Fades in & scales up synchronously */}
                  <span
                    className={`absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-error text-[10px] font-bold text-on-error transition-all duration-500 ease-out ${
                      hasLiked ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
                    }`}
                  >
                    1
                  </span>
                </div>
              </div>

              {/* Notification Card — Fades in & scales up synchronously */}
              <div
                className={`rounded-xl bg-surface-container-low p-xs border border-outline-variant/20 transition-all duration-500 ease-out ${
                  hasLiked ? 'opacity-100 translate-y-0 scale-100' : 'opacity-40 translate-y-1 scale-95'
                }`}
              >
                <div className="flex items-start gap-xs">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary-container text-secondary text-[11px] font-bold mt-0.5">
                    D
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] leading-tight text-on-surface font-medium">
                      <span className="font-bold">Daniel</span> liked your entry
                    </p>
                    <span className="text-[10px] text-on-surface-variant">just now</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Caption under Node 4 */}
            <div className="mt-sm pt-xs border-t border-outline-variant/15 text-center">
              <p className="text-label-md font-bold text-on-surface">Notification to you</p>
            </div>
          </div>

        </div>
      </section>

      {/* APP SHOWCASE - 1:1 EXACT APPLICATION VIEWS */}
      <section id="showcase" className="px-container-margin py-20 bg-surface-container-low/80 border-t border-outline-variant/20">
        <div className="max-w-5xl mx-auto text-center">
          <span className="px-md py-xs rounded-full bg-primary-container text-on-primary-container text-label-sm font-semibold">
            1:1 Mobile Interface Preview
          </span>
          <h2 className="mt-xs text-3xl md:text-4xl font-bold text-on-surface">Explore the Real App Screens</h2>
          <p className="mt-xs text-body-md text-on-surface-variant max-w-lg mx-auto">
            Experience MoodShare’s exact layouts — adapted directly from the live application components.
          </p>

          {/* View Switcher Tabs */}
          <div className="mt-md inline-flex p-1 rounded-2xl bg-surface-container cloud-shadow mb-lg">
            <button
              onClick={() => setActiveTab('home')}
              className={`px-md py-xs rounded-xl text-label-lg font-semibold transition-all ${
                activeTab === 'home'
                  ? 'bg-white text-on-surface shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Home Summary
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`px-md py-xs rounded-xl text-label-lg font-semibold transition-all ${
                activeTab === 'calendar'
                  ? 'bg-white text-on-surface shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Monthly & Weekly Calendar
            </button>
            <button
              onClick={() => setActiveTab('feed')}
              className={`px-md py-xs rounded-xl text-label-lg font-semibold transition-all ${
                activeTab === 'feed'
                  ? 'bg-white text-on-surface shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Friend Feed
            </button>
          </div>

          {/* Device Mockup Shell */}
          <div className="mx-auto max-w-md bg-background text-on-background rounded-[36px] border-[8px] border-surface-container-highest shadow-2xl overflow-hidden relative text-left">
            
            {/* 1:1 HOME SUMMARY VIEW */}
            {activeTab === 'home' && (
              <div className="min-h-[640px] pb-28 pt-sm px-container-margin space-y-md animate-fadeIn">
                <header className="flex items-center justify-between py-xs">
                  <div className="flex items-center gap-sm">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-container font-semibold text-secondary text-body-md">
                      A
                    </div>
                    <h1 className="text-headline-lg-mobile font-headline-lg-mobile text-on-surface font-bold">Moodila</h1>
                  </div>
                  <div className="flex items-center gap-xs">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface-variant cloud-shadow">
                      <span className="material-symbols-outlined text-[20px]">notifications</span>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface-variant cloud-shadow">
                      <span className="material-symbols-outlined text-[20px]">logout</span>
                    </div>
                  </div>
                </header>

                <section className="relative overflow-hidden rounded-[24px] bg-primary-container p-lg cloud-shadow">
                  <div className="relative z-10 flex max-w-full flex-col items-start gap-md">
                    <h2 className="text-headline-lg font-headline-lg text-on-primary-container font-bold">
                      Good evening, Alex 🌸
                    </h2>
                    <div className="flex items-center gap-xs rounded-full bg-primary px-lg py-sm text-label-lg font-label-lg text-on-primary shadow-md">
                      Journal today
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </div>
                  </div>
                </section>

                <section className="space-y-md">
                  <div className="flex items-end justify-between">
                    <h2 className="text-label-lg font-label-lg text-on-surface-variant">This week's mood</h2>
                    <span className="text-label-sm font-label-sm text-primary cursor-pointer hover:underline">See more</span>
                  </div>
                  <div className="flex justify-between gap-xs overflow-x-auto rounded-[24px] bg-white/40 p-md cloud-shadow">
                    {[
                      { day: 'Mon', mood: 5 },
                      { day: 'Tue', mood: 4 },
                      { day: 'Wed', mood: 4 },
                      { day: 'Thu', mood: 3 },
                      { day: 'Fri', mood: 5, today: true },
                      { day: 'Sat', mood: null },
                      { day: 'Sun', mood: null },
                    ].map((item, idx) => {
                      const mInfo = item.mood ? APP_MOODS[item.mood] : null
                      return (
                        <div key={idx} className="flex min-w-10 flex-col items-center gap-xs">
                          <span
                            className={`flex h-11 w-11 items-center justify-center rounded-full ${
                              mInfo ? mInfo.bg : 'bg-surface-variant'
                            } ${item.today ? 'ring-2 ring-primary' : ''}`}
                          >
                            {mInfo ? (
                              <span
                                className={`material-symbols-outlined text-[24px] ${mInfo.color}`}
                                style={{ fontVariationSettings: "'FILL' 1" }}
                              >
                                {mInfo.icon}
                              </span>
                            ) : (
                              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">add</span>
                            )}
                          </span>
                          <span className={`text-label-sm font-label-sm ${item.today ? 'font-bold text-primary' : 'text-on-surface-variant'}`}>
                            {item.day}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </section>

                <section className="grid grid-cols-2 gap-md">
                  <div className="col-span-2 rounded-[24px] bg-surface-container-lowest p-lg cloud-shadow">
                    <h2 className="text-headline-lg font-headline-lg text-on-surface">Mood summary</h2>
                    <div className="mt-sm flex items-baseline gap-xs">
                      <span className="text-headline-xl font-headline-xl text-on-surface font-bold">24</span>
                      <span className="text-body-md font-body-md text-on-surface-variant">entries</span>
                    </div>
                    <p className="mt-1 text-body-sm font-body-sm text-on-surface-variant">Total moods logged this month</p>
                  </div>
                  <div className="flex min-h-[120px] flex-col justify-between rounded-[24px] bg-primary-container/30 p-md">
                    <span className="text-label-sm font-label-sm text-on-surface-variant">Dominant mood</span>
                    <div className="flex items-center gap-xs">
                      <span
                        className="material-symbols-outlined text-[28px] text-primary"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        sentiment_satisfied
                      </span>
                      <span className="text-headline-lg font-headline-lg text-on-surface font-semibold">Good</span>
                    </div>
                  </div>
                  <div className="flex min-h-[120px] flex-col justify-between rounded-[24px] bg-secondary-container/30 p-md">
                    <span className="text-label-sm font-label-sm text-on-surface-variant">Most used tag</span>
                    <div className="flex items-center gap-xs">
                      <span className="material-symbols-outlined text-[24px] text-secondary">auto_awesome</span>
                      <span className="text-headline-lg font-headline-lg text-on-surface font-semibold truncate">Coffee</span>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* 1:1 MONTHLY & WEEKLY CALENDAR VIEW */}
            {activeTab === 'calendar' && (
              <div className="min-h-[640px] pb-28 pt-sm px-container-margin space-y-md animate-fadeIn">
                <header className="py-xs">
                  <div className="flex items-center justify-between rounded-[24px] bg-surface-container-lowest p-md text-left cloud-shadow">
                    <span className="text-headline-lg-mobile font-headline-lg-mobile font-bold">Your calendar</span>
                    <span className="material-symbols-outlined text-primary">expand_more</span>
                  </div>
                </header>

                <section aria-label="Calendar view">
                  <div className="flex gap-1 rounded-full bg-surface-container-low p-1">
                    <button
                      type="button"
                      onClick={() => setCalViewMode('week')}
                      className={`flex-1 rounded-full py-2 text-label-lg font-label-lg transition-all ${
                        calViewMode === 'week'
                          ? 'bg-surface-container-lowest text-on-surface cloud-shadow font-bold'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      Week
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalViewMode('month')}
                      className={`flex-1 rounded-full py-2 text-label-lg font-label-lg transition-all ${
                        calViewMode === 'month'
                          ? 'bg-surface-container-lowest text-on-surface cloud-shadow font-bold'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      Month
                    </button>
                  </div>
                </section>

                <section className="flex items-center justify-between">
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant active:scale-95"
                  >
                    <span className="material-symbols-outlined">chevron_left</span>
                  </button>
                  <h2 className="text-headline-lg-mobile font-headline-lg-mobile font-bold">
                    {calViewMode === 'month' ? 'August 2026' : 'Aug 10 – Aug 16, 2026'}
                  </h2>
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant active:scale-95"
                  >
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </section>

                {calViewMode === 'month' ? (
                  <section className="space-y-md">
                    <div className="grid grid-cols-7 text-center select-none">
                      {['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].map((day) => (
                        <span key={day} className="pb-sm text-label-sm font-label-sm text-on-surface-variant/60">
                          {day}
                        </span>
                      ))}

                      {[27, 28, 29, 30, 31].map((d) => (
                        <span key={`prev-${d}`} className="flex h-[76px] items-start justify-center pt-1 text-body-md font-body-md text-on-surface-variant/20">
                          {d}
                        </span>
                      ))}

                      {Array.from({ length: 31 }).map((_, i) => {
                        const dayNum = i + 1
                        const entry = MOCK_CALENDAR_ENTRIES[dayNum]
                        const mood = entry ? APP_MOODS[entry.mood] : null
                        const isSelected = selectedDay === dayNum

                        return (
                          <div
                            key={dayNum}
                            onClick={() => setSelectedDay(dayNum)}
                            className="flex h-[76px] flex-col items-center gap-1 text-body-md font-body-md cursor-pointer select-none"
                          >
                            <span className={`flex items-center gap-0.5 ${isSelected ? 'font-bold text-primary' : ''}`}>
                              {dayNum}
                            </span>
                            <span
                              className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${
                                mood
                                  ? `${mood.bg} ${isSelected ? 'ring-2 ring-primary' : ''}`
                                  : 'border-2 border-dashed border-outline-variant text-outline-variant'
                              }`}
                            >
                              {mood ? (
                                <span
                                  className={`material-symbols-outlined text-[20px] ${mood.color}`}
                                  style={{ fontVariationSettings: "'FILL' 1" }}
                                >
                                  {mood.icon}
                                </span>
                              ) : (
                                <span className="material-symbols-outlined text-[20px]">add</span>
                              )}
                            </span>
                          </div>
                        )
                      })}

                      {[1, 2, 3, 4, 5, 6].map((d) => (
                        <span key={`next-${d}`} className="flex h-[76px] items-start justify-center pt-1 text-body-md font-body-md text-on-surface-variant/20">
                          {d}
                        </span>
                      ))}
                    </div>

                    <div className="rounded-[24px] bg-surface-container-lowest p-md cloud-shadow space-y-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-label-sm font-bold text-primary">August {selectedDay}, 2026</span>
                        {MOCK_CALENDAR_ENTRIES[selectedDay] ? (
                          <span className={`px-sm py-0.5 rounded-full text-label-sm font-medium ${APP_MOODS[MOCK_CALENDAR_ENTRIES[selectedDay].mood].bg} ${APP_MOODS[MOCK_CALENDAR_ENTRIES[selectedDay].mood].color}`}>
                            {APP_MOODS[MOCK_CALENDAR_ENTRIES[selectedDay].mood].label}
                          </span>
                        ) : (
                          <span className="text-label-sm text-on-surface-variant">No entry logged</span>
                        )}
                      </div>
                      <p className="text-body-sm text-on-surface">
                        {MOCK_CALENDAR_ENTRIES[selectedDay] ? `"${MOCK_CALENDAR_ENTRIES[selectedDay].note}"` : 'Tap + on any day to create a new mood journal entry.'}
                      </p>
                      {MOCK_CALENDAR_ENTRIES[selectedDay]?.tags && (
                        <div className="flex flex-wrap gap-xs pt-xs">
                          {MOCK_CALENDAR_ENTRIES[selectedDay].tags.map((t) => (
                            <span key={t} className="rounded-full bg-surface-container px-sm py-xs text-label-sm text-on-surface-variant">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                ) : (
                  <section className="space-y-sm select-none">
                    <div className="flex items-center justify-between px-1 pb-xs">
                      <h3 className="text-label-lg font-bold text-on-surface flex items-center gap-1">
                        <span className="material-symbols-outlined text-[18px] text-primary">view_day</span>
                        Weekly Flow
                      </h3>
                      <span className="text-label-sm text-on-surface-variant/60">Aug 10 - Aug 16</span>
                    </div>

                    {[
                      { day: 'Mon', num: 10, mood: 3, text: 'Routine Monday, steady work.', tag: 'Focused' },
                      { day: 'Tue', num: 11, mood: null, text: 'No entry logged', tag: null },
                      { day: 'Wed', num: 12, mood: 1, text: 'Overwhelmed with tasks.', tag: 'Overwhelmed' },
                      { day: 'Thu', num: 13, mood: 4, text: 'Felt much better after chatting.', tag: 'Peaceful' },
                      { day: 'Fri', num: 14, mood: 2, text: 'Felt rainy and quiet.', tag: 'Rainy Vibe' },
                      { day: 'Sat', num: 15, mood: 5, text: 'Had an inspiring session!', tag: 'Breakthrough', selected: true },
                      { day: 'Sun', num: 16, mood: null, text: 'No entry logged', tag: null },
                    ].map((item, idx) => {
                      const mInfo = item.mood ? APP_MOODS[item.mood] : null
                      return (
                        <div
                          key={idx}
                          className={`flex items-center justify-between rounded-[24px] p-md transition-all ${
                            item.selected
                              ? 'bg-surface-container-lowest ring-2 ring-primary cloud-shadow'
                              : 'bg-surface-container-lowest cloud-shadow'
                          }`}
                        >
                          <div className="flex items-center gap-md flex-1 min-w-0">
                            <div
                              className={`flex flex-col items-center justify-center rounded-2xl px-3 py-2 min-w-[54px] shrink-0 ${
                                item.selected
                                  ? 'bg-primary text-on-primary font-bold cloud-shadow'
                                  : 'bg-surface-container-low text-on-surface'
                              }`}
                            >
                              <span className="text-[11px] font-bold uppercase tracking-wider opacity-80">
                                {item.day}
                              </span>
                              <span className="text-xl font-bold leading-none mt-0.5">{item.num}</span>
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="text-body-sm text-on-surface truncate font-medium">
                                {item.text}
                              </p>
                              {item.tag && (
                                <span className="inline-block mt-xs rounded-full bg-surface-container-low px-xs py-0.5 text-[11px] text-on-surface-variant">
                                  #{item.tag}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="ml-md shrink-0">
                            {mInfo ? (
                              <span className={`flex h-11 w-11 items-center justify-center rounded-full ${mInfo.bg}`}>
                                <span className={`material-symbols-outlined text-[24px] ${mInfo.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                                  {mInfo.icon}
                                </span>
                              </span>
                            ) : (
                              <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed border-outline-variant text-outline-variant">
                                <span className="material-symbols-outlined text-[18px]">add</span>
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </section>
                )}
              </div>
            )}

            {/* 1:1 FRIENDS FEED VIEW */}
            {activeTab === 'feed' && (
              <div className="min-h-[640px] pb-28 pt-sm px-container-margin space-y-md animate-fadeIn">
                <header className="py-xs">
                  <p className="text-label-sm font-label-sm uppercase tracking-[0.12em] text-primary">Your circle</p>
                  <h1 className="mt-xs text-headline-xl font-headline-xl text-on-surface font-bold">Friend feed</h1>
                  <p className="mt-xs text-body-sm text-on-surface-variant">A gentle look at how everyone’s doing.</p>
                </header>

                <div className="rounded-[24px] bg-white p-md cloud-shadow space-y-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-xs">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-tertiary-container text-tertiary font-bold">
                        M
                      </div>
                      <div>
                        <h4 className="text-label-lg font-label-lg text-on-surface font-bold">Maria Chen</h4>
                        <p className="text-body-sm text-on-surface-variant">2 hours ago</p>
                      </div>
                    </div>
                    <span
                      className="material-symbols-outlined text-[28px] text-tertiary"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      sentiment_very_satisfied
                    </span>
                  </div>

                  <p className="text-body-md text-on-surface">
                    Finished my morning run! The fresh air was just what I needed to start the weekend. 🌿✨
                  </p>

                  <div className="flex flex-wrap gap-xs">
                    <span className="px-sm py-0.5 rounded-full bg-primary-container/40 text-label-sm text-on-primary-container">
                      #Peaceful
                    </span>
                    <span className="px-sm py-0.5 rounded-full bg-secondary-container/40 text-label-sm text-on-secondary-container">
                      #FreshAir
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-xs border-t border-outline-variant/20">
                    <div className="flex items-center gap-xs text-label-sm text-primary font-semibold">
                      <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        favorite
                      </span>
                      <span>5 Likes</span>
                    </div>
                    <span className="text-label-sm text-on-surface-variant">2 comments</span>
                  </div>
                </div>

                <div className="rounded-[24px] bg-white p-md cloud-shadow space-y-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-xs">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-container text-secondary font-bold">
                        D
                      </div>
                      <div>
                        <h4 className="text-label-lg font-label-lg text-on-surface font-bold">Daniel Kim</h4>
                        <p className="text-body-sm text-on-surface-variant">Yesterday at 9:15 PM</p>
                      </div>
                    </div>
                    <span
                      className="material-symbols-outlined text-[28px] text-primary"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      sentiment_satisfied
                    </span>
                  </div>

                  <p className="text-body-md text-on-surface">
                    Quiet evening with herbal tea and music. Taking things slow.
                  </p>

                  <div className="flex items-center justify-between pt-xs border-t border-outline-variant/20">
                    <div className="flex items-center gap-xs text-label-sm text-primary font-semibold">
                      <span className="material-symbols-outlined text-[18px]">favorite</span>
                      <span>3 Likes</span>
                    </div>
                    <span className="text-label-sm text-on-surface-variant">1 comment</span>
                  </div>
                </div>
              </div>
            )}

            {/* 1:1 BOTTOM NAV BAR */}
            <nav className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex w-[calc(100%-32px)] items-center justify-around rounded-full bg-surface/90 px-3 py-1.5 cloud-shadow backdrop-blur-xl border border-outline-variant/20">
              {[
                { key: 'home', icon: 'home', label: 'Home' },
                { key: 'calendar', icon: 'calendar_today', label: 'Calendar' },
                { key: 'add', icon: 'add', label: 'Add' },
                { key: 'feed', icon: 'grid_view', label: 'Feed' },
                { key: 'profile', icon: 'person', label: 'Profile' },
              ].map((item) => {
                const active = activeTab === item.key
                return (
                  <button
                    key={item.key}
                    onClick={() => item.key !== 'add' && item.key !== 'profile' && setActiveTab(item.key)}
                    className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                      item.icon === 'add'
                        ? 'h-11 w-11 bg-on-background text-background shadow-md'
                        : active
                          ? 'bg-primary-container text-on-primary-container'
                          : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span
                      className="material-symbols-outlined text-[20px]"
                      style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
                    >
                      {item.icon}
                    </span>
                  </button>
                )
              })}
            </nav>
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section id="faq" className="px-container-margin py-20 max-w-4xl mx-auto w-full">
        <div className="text-center mb-xl">
          <h2 className="text-3xl md:text-4xl font-bold text-on-surface">Frequently Asked Questions</h2>
          <p className="mt-xs text-body-md text-on-surface-variant">
            Everything you need to know about MoodShare.
          </p>
        </div>

        <div className="space-y-md">
          {FAQS.map((faq, index) => {
            const isOpen = openFaq === index
            return (
              <div
                key={index}
                className="bg-white rounded-2xl border border-outline-variant/30 cloud-shadow overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  className="w-full p-md text-left flex items-center justify-between font-bold text-on-surface text-body-md md:text-lg hover:bg-surface-container-low transition-colors"
                >
                  <span>{faq.q}</span>
                  <span className="text-xl font-normal text-on-surface-variant ml-xs">
                    {isOpen ? '−' : '+'}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-md pb-md text-body-md text-on-surface-variant leading-relaxed border-t border-outline-variant/10 pt-sm">
                    {faq.a}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* FINAL CALL TO ACTION */}
      <section className="px-container-margin py-20 bg-gradient-to-r from-primary-container/50 via-secondary-container/50 to-tertiary-container/50 text-center">
        <div className="max-w-3xl mx-auto">
          <span className="text-4xl mb-sm block">🌸</span>
          <h2 className="text-3xl md:text-4xl font-bold text-on-surface">
            Ready for a calm, mindful routine?
          </h2>
          <p className="mt-xs text-body-md md:text-lg text-on-surface-variant max-w-xl mx-auto">
            Join MoodShare today and take your first step toward gentle self-reflection.
          </p>
          <div className="mt-lg">
            <Link
              to="/login"
              className="inline-block px-xl py-md rounded-full bg-primary-container text-on-primary-container text-label-lg font-bold hover:shadow-lg transition-all transform hover:-translate-y-0.5"
            >
              Get Started for Free
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="px-container-margin py-lg border-t border-outline-variant/20 bg-background text-on-surface-variant text-body-sm">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-md">
          <div className="flex items-center gap-xs font-bold text-on-surface">
            <span className="w-6 h-6 rounded-full bg-primary-container flex items-center justify-center text-xs">
              🌸
            </span>
            <span>MoodShare</span>
          </div>

          <div className="flex gap-md text-label-sm">
            <Link to="/login" className="hover:underline">
              Log in
            </Link>
            <a href="#features" className="hover:underline">
              Features
            </a>
            <a href="#faq" className="hover:underline">
              FAQ
            </a>
          </div>

          <p>© {new Date().getFullYear()} MoodShare. Crafted with care.</p>
        </div>
      </footer>
    </div>
  )
}
