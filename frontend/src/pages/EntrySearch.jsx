import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import MoodIcon from '../components/MoodIcon'
import { useEntrySearchQuery, useEntrySearchTagsQuery } from '../api/queries'
import { useLanguage } from '../context/LanguageContext'
import { ALL_TAGS, getLocalizedTag, getMoodInfo } from '../utils/moods'
import { searchRequest, searchSnippet } from '../utils/entrySearch'

const field = 'mt-2 min-h-11 w-full min-w-0 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-md text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary'
const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-label-md font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50'

export default function EntrySearch() {
  const { t, formatDate } = useLanguage()
  const copy = (key) => t(`entrySearch.${key}`)
  const [params, setParams] = useSearchParams()
  const query = params.get('q') || ''
  const [draft, setDraft] = useState(query)
  useEffect(() => { setDraft(query) }, [query])
  const result = useEntrySearchQuery(searchRequest(params))
  const tagQuery = useEntrySearchTagsQuery()
  const tags = [...new Set([...ALL_TAGS, ...(tagQuery.data || []), ...params.getAll('tag')])]
  const entries = result.data?.pages.flatMap((page) => page.entries) || []
  const loadRef = useRef(null)
  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = result
  useEffect(() => {
    const node = loadRef.current
    if (!node || !hasNextPage || isFetchingNextPage || isError) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) fetchNextPage()
    }, { rootMargin: '150px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage])

  const update = (key, value) => {
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.delete(key)
      if (value) next.set(key, value)
      return next
    }, { replace: true })
  }
  const toggle = (key, value) => {
    const next = new URLSearchParams(params)
    const selected = next.getAll(key)
    next.delete(key)
    for (const item of selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]) next.append(key, item)
    setParams(next, { replace: true })
  }
  const reset = () => setParams(query ? { q: query } : {}, { replace: true })
  const [filtersOpen, setFiltersOpen] = useState(false)
  const period = params.get('period') || (params.has('month') ? 'month' : params.has('from') || params.has('to') ? 'custom' : 'all')
  const changePeriod = (value) => {
    const next = new URLSearchParams(params)
    for (const key of ['period', 'month', 'from', 'to']) next.delete(key)
    if (value !== 'all') next.set('period', value)
    if (value === 'month') {
      const now = new Date()
      next.set('month', `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
    }
    setParams(next, { replace: true })
  }
  const chips = [...params].filter(([key]) => key !== 'q' && key !== 'period').map(([key, value]) => ({
    key, value,
    label: key === 'mood' ? getMoodInfo(Number(value), t).label : key === 'tag' ? `#${getLocalizedTag(value, t)}` : key === 'photo' || key === 'audio' ? copy(key) : key === 'month' ? formatDate(`${value}-01`, { month: 'long', year: 'numeric' }) : `${copy(key)}: ${value}`,
  }))

  return <AppLayout>
    <main className="mx-auto w-full max-w-4xl px-4 pb-32 pt-6 text-on-surface sm:px-8 lg:pb-12 lg:pt-10">
      <Link to="/calendar" className={`${button} mb-4 -ml-4 text-primary`}><span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>{copy('back')}</Link>
      <h1 className="mb-7 text-[28px] font-bold leading-tight tracking-tight sm:text-[36px]">{copy('title')}</h1>
      <p className="sr-only">{copy('subtitle')}</p>
      <form role="search" className="mb-5 flex items-center gap-3" onSubmit={(event) => { event.preventDefault(); update('q', draft.trim()) }}>
        <div className="relative min-w-0 flex-1">
          <button type="submit" aria-label={copy('submit')} className="absolute inset-y-0 left-1 flex w-12 items-center justify-center rounded-full text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><span className="material-symbols-outlined text-[26px]" aria-hidden="true">search</span></button>
          <label><span className="sr-only">{copy('words')}</span><input type="search" value={draft} maxLength={200} onChange={(event) => setDraft(event.target.value)} placeholder={copy('wordsPlaceholder')} className="h-14 w-full min-w-0 rounded-full border border-outline bg-transparent pl-14 pr-4 text-body-md text-on-surface placeholder:text-on-surface-variant focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" /></label>
        </div>
        <button type="button" aria-expanded={filtersOpen} aria-controls="journal-search-filters" onClick={() => setFiltersOpen(!filtersOpen)} className={`${button} h-14 shrink-0 bg-surface-container-high text-on-surface hover:bg-surface-container-highest`}><span className="material-symbols-outlined" aria-hidden="true">tune</span>{copy('filters')}</button>
      </form>
      <div className="space-y-7">
        <aside aria-label={copy('filters')} hidden={!filtersOpen}>
          <div id="journal-search-filters" className="grid gap-5 rounded-2xl border border-outline-variant bg-surface-container-low p-5 sm:grid-cols-2">
          <label className="block text-label-md font-semibold">{copy('period')}<select className={field} value={period} onChange={(e) => changePeriod(e.target.value)}><option value="all">{copy('all')}</option><option value="month">{copy('month')}</option><option value="custom">{copy('custom')}</option></select></label>
          {period === 'month' && <label className="block text-label-md">{copy('month')}<input type="month" required value={params.get('month') || ''} onChange={(e) => update('month', e.target.value)} className={field} /></label>}
          {period === 'custom' && <div className="grid grid-cols-2 gap-3">{['from', 'to'].map((key) => <label key={key} className="min-w-0 text-label-md">{copy(key)}<input type="date" value={params.get(key) || ''} max={key === 'from' ? params.get('to') || undefined : undefined} min={key === 'to' ? params.get('from') || undefined : undefined} onChange={(e) => update(key, e.target.value)} className={field} /></label>)}</div>}
          <fieldset><legend className="mb-2 text-label-md font-semibold">{copy('mood')}</legend><div className="flex flex-wrap gap-2">{[1, 2, 3, 4, 5].map((mood) => <button key={mood} type="button" aria-label={getMoodInfo(mood, t).label} title={getMoodInfo(mood, t).label} aria-pressed={params.getAll('mood').includes(String(mood))} onClick={() => toggle('mood', String(mood))} className="flex h-12 w-12 items-center justify-center rounded-xl border border-outline-variant aria-pressed:border-primary aria-pressed:bg-primary-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><MoodIcon mood={mood} className="text-[30px]" /></button>)}</div></fieldset>
          <label className="block text-label-md font-semibold">{copy('tags')}<select className={field} value="" onChange={(e) => { if (e.target.value) toggle('tag', e.target.value) }}><option value="">{copy('chooseTag')}</option>{tags.filter((tag) => !params.getAll('tag').includes(tag)).map((tag) => <option key={tag} value={tag}>{getLocalizedTag(tag, t)}</option>)}</select><span className="mt-2 block text-body-sm font-normal text-on-surface-variant">{copy('tagsHint')}</span></label>
          {tagQuery.isError && <p role="alert" className="text-body-sm text-error">{copy('tagsError')} <button onClick={() => tagQuery.refetch()} className="underline">{copy('retry')}</button></p>}
          <fieldset className="space-y-1"><legend className="mb-2 text-label-md font-semibold">{copy('media')}</legend>{['photo', 'audio'].map((key) => <label key={key} className="flex min-h-11 items-center gap-3 text-body-md"><input type="checkbox" checked={params.get(key) === 'true'} onChange={(e) => update(key, e.target.checked ? 'true' : '')} className="h-5 w-5 accent-primary" />{copy(key)}</label>)}</fieldset>
          </div>
        </aside>
        <section aria-label={copy('results')} aria-busy={result.isFetching} className="min-w-0">
          {chips.length > 0 && <div className="mb-5 flex flex-wrap items-center gap-2">{chips.map(({ key, value, label }) => <button key={`${key}-${value}`} onClick={() => ['mood', 'tag'].includes(key) ? toggle(key, value) : update(key, '')} aria-label={`${copy('remove')}: ${label}`} className={`${button} bg-primary-container text-on-primary-container`}>{label}<span className="material-symbols-outlined text-lg" aria-hidden="true">close</span></button>)}<button onClick={reset} className={`${button} text-primary underline underline-offset-4`}>{copy('reset')}</button></div>}
          <div className="mb-5 flex items-baseline justify-between gap-4"><h2 className="text-title-lg font-bold sm:text-headline-sm">{copy('results')}</h2>{!result.isPending && !result.isError && <span className="text-body-md text-on-surface-variant">{t('entrySearch.shown', { count: `${entries.length}${result.hasNextPage ? '+' : ''}` })}</span>}</div>
          {result.isPending && <p role="status" className="py-10 text-on-surface-variant">{t('common.loading')}</p>}
          {result.isError && <div role="alert" className="mb-4 rounded-xl bg-error-container p-4 text-on-error-container"><p>{copy('error')}</p><button onClick={() => result.refetch()} className={`${button} mt-2 underline`}>{copy('retry')}</button></div>}
          {!result.isPending && !result.isError && entries.length === 0 && <div className="rounded-xl bg-surface-container-low p-6 text-center"><h2 className="text-title-md font-semibold">{copy('empty')}</h2><p className="mt-2 text-body-md text-on-surface-variant">{copy('emptyHint')}</p>{chips.length > 0 && <button onClick={reset} className={`${button} mt-4 text-primary underline`}>{copy('reset')}</button>}</div>}
          <div className="space-y-4">{entries.map((entry) => {
            const mood = getMoodInfo(entry.mood, t)
            return <Link key={entry.id} to={`/entries/new?date=${entry.date}`} className={`group relative flex items-start gap-4 rounded-[24px] border ${mood.border} bg-surface-container-low p-5 transition-colors hover:bg-surface-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:gap-5 sm:p-6`}>
              <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${mood.bg} sm:h-16 sm:w-16`}><MoodIcon mood={entry.mood} className="text-[38px] sm:text-[44px]" /></span>
              <div className="min-w-0 flex-1">
                <p className="pr-5 text-body-lg font-semibold leading-snug text-on-surface">{formatDate(entry.date, { year: 'numeric', month: 'long', day: 'numeric' })} · {mood.label}</p>
                <p className={`mt-2 whitespace-pre-wrap break-words text-body-md leading-relaxed text-on-surface-variant ${entry.text ? '' : 'italic'}`}>{entry.text ? searchSnippet(entry.text, query).map((part, index) => part.match ? <mark key={index} className="rounded-sm bg-primary-container text-on-primary-container">{part.text}</mark> : part.text) : copy('noNote')}</p>
                {entry.tags.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{entry.tags.map((tag) => <span key={tag} className="max-w-full break-words rounded-full bg-primary-container px-3 py-1 text-label-md text-on-primary-container">#{getLocalizedTag(tag, t)}</span>)}</div>}
              </div>
              <span className="material-symbols-outlined absolute right-4 top-6 text-on-surface-variant sm:right-6 sm:top-7" aria-hidden="true">chevron_right</span>
            </Link>
          })}</div>
          <div ref={loadRef}>{result.hasNextPage && <button disabled={result.isFetchingNextPage} onClick={() => result.fetchNextPage()} className={`${button} my-5 w-full bg-surface-container-high text-on-surface`}>{result.isFetchingNextPage ? t('common.loading') : copy('more')}</button>}</div>
          <p role="status" className="sr-only">{!result.isFetching && `${copy('results')}: ${entries.length}`}</p>
        </section>
      </div>
    </main>
  </AppLayout>
}
