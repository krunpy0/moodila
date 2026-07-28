import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useProfileQuery, useUpdateProfileMutation } from '../api/queries'
import { uploadEntryPhoto } from '../api/entries'
import BottomNav from '../components/BottomNav'
import HeaderBell from '../components/HeaderBell'
import { ProfileSkeleton } from '../components/skeleton/PageSkeletons'
import { useNotifications } from '../components/Notifications'
import { useTheme } from '../context/ThemeContext'

const moods = { 1: '😞', 2: '😔', 3: '😐', 4: '😊', 5: '😁' }

export default function Profile() {
  const navigate = useNavigate()
  const profileQuery = useProfileQuery()
  const update = useUpdateProfileMutation()
  const { notify } = useNotifications()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)
  const [avatarStatus, setAvatarStatus] = useState('')
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const profile = profileQuery.data
  const user = profile?.user
  const beginEdit = () => {
    setForm({ display_name: user.display_name || '', avatar_url: user.avatar_url || '' })
    setAvatarStatus('')
    setEditing(true)
  }
  const cancelEdit = () => {
    setEditing(false)
    setAvatarStatus('')
  }
  const save = (event) => {
    event.preventDefault()
    update.mutate(form, { onSuccess: () => { setEditing(false); setAvatarStatus(''); notify('Profile updated.') } })
  }
  const selectAvatar = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setAvatarStatus('Choose an image file.'); notify('Choose an image file.', 'error'); return }
    if (file.size > 10 * 1024 * 1024) { setAvatarStatus('Image must be 10 MB or smaller.'); notify('Image must be 10 MB or smaller.', 'error'); return }

    setIsUploadingAvatar(true)
    setAvatarStatus('Uploading photo...')
    try {
      const avatarURL = await uploadEntryPhoto(file)
      setForm((current) => ({ ...current, avatar_url: avatarURL }))
      setAvatarStatus('Photo ready to save.')
      notify('Photo ready to save.')
    } catch (error) {
      setAvatarStatus(error.message)
      notify(error.message, 'error')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  return <main className="mx-auto min-h-screen w-full max-w-md bg-background pb-32 text-on-background">
    <header className="flex items-center justify-between px-container-margin py-md"><button type="button" aria-label="Go back" onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-full text-primary"><span className="material-symbols-outlined">arrow_back</span></button><h1 className="text-headline-lg-mobile font-headline-lg-mobile text-on-surface">Profile</h1><div className="flex items-center gap-xs"><HeaderBell /><button type="button" aria-label="Edit profile" onClick={beginEdit} disabled={!user} className="flex h-10 w-10 items-center justify-center rounded-full text-primary disabled:opacity-40"><span className="material-symbols-outlined">edit</span></button></div></header>
    <div className="px-container-margin pt-sm">
      {profileQuery.isLoading && <ProfileSkeleton />}
      {profileQuery.error && <p role="alert" className="text-center text-body-sm text-error">{profileQuery.error.message}</p>}
      {user && <>
        <section className="mb-8 flex flex-col items-center"><div className="relative mb-md"><Avatar user={editing ? form : user} large />{editing && <label className={`absolute bottom-1 right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-primary-container text-on-primary-container shadow-md transition-transform active:scale-95 ${isUploadingAvatar ? 'cursor-wait opacity-60' : ''}`}><span className="material-symbols-outlined text-[18px]">{isUploadingAvatar ? 'progress_activity' : 'edit'}</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={selectAvatar} disabled={isUploadingAvatar} className="sr-only" /><span className="sr-only">Choose profile photo</span></label>}</div><h2 className="text-headline-xl font-headline-xl text-on-surface">{editing ? form.display_name || user.username : user.display_name || user.username}</h2><p className="text-body-md text-on-surface-variant">@{user.username}</p></section>
        {editing && <form onSubmit={save} className="mb-8 space-y-md rounded-[24px] bg-surface-container-lowest p-lg cloud-shadow"><div><p className="text-label-lg text-on-surface-variant">Profile photo</p><p className="mt-xs text-body-sm text-on-surface-variant">Tap the pencil on your photo to choose an image.</p>{avatarStatus && <p role="status" className={`mt-xs text-body-sm ${avatarStatus === 'Photo ready to save.' ? 'text-primary' : avatarStatus === 'Uploading photo...' ? 'text-on-surface-variant' : 'text-error'}`}>{avatarStatus}</p>}{form.avatar_url && <button type="button" onClick={() => { setForm((current) => ({ ...current, avatar_url: '' })); setAvatarStatus('Photo will be removed when you save.') }} disabled={isUploadingAvatar} className="mt-sm text-label-lg text-primary disabled:opacity-50">Remove photo</button>}</div><label className="block text-label-sm text-on-surface-variant">Display name<input value={form.display_name} maxLength={60} onChange={(e) => setForm({ ...form, display_name: e.target.value })} className="mt-xs w-full rounded-xl bg-surface-container-low px-md py-sm text-body-md outline-none focus:ring-2 focus:ring-primary/20" required /></label><div className="flex gap-sm pt-xs"><button type="button" onClick={cancelEdit} disabled={isUploadingAvatar} className="flex-1 rounded-full bg-surface-container-highest py-sm text-label-lg text-on-surface-variant disabled:opacity-50">Cancel</button><button type="submit" disabled={update.isPending || isUploadingAvatar} className="flex-1 rounded-full bg-primary py-sm text-label-lg text-on-primary disabled:opacity-50">{isUploadingAvatar ? 'Uploading...' : update.isPending ? 'Saving...' : 'Save'}</button></div>{update.error && <p role="alert" className="text-body-sm text-error">{update.error.message}</p>}</form>}
        <section className="mb-8"><div className="mb-md flex items-center justify-between"><h2 className="text-headline-lg font-headline-lg text-on-surface">Recent entries</h2><Link to="/calendar" className="text-label-lg text-primary">See all</Link></div><div className="grid grid-cols-2 gap-md">{(profile.recent_entries || []).map((entry) => <Link key={entry.id} to={`/entries/new?date=${entry.date}`} className="flex min-h-[140px] flex-col justify-between rounded-[24px] bg-surface-container-lowest p-lg cloud-shadow"><div className="flex items-start justify-between"><span className="flex items-center gap-1 text-label-sm text-on-surface-variant">{entry.is_hidden && <span className="material-symbols-outlined text-[13px]" title="Hidden from friends">lock</span>}{formatDate(entry.date)}</span><span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-container text-lg">{moods[entry.mood] || '😐'}</span></div><p className="line-clamp-2 text-body-sm text-on-surface">{entry.text || entry.tags?.[0] || 'No note for this day.'}</p></Link>)}</div>{profile.recent_entries?.length === 0 && <p className="rounded-[24px] bg-surface-container-low p-lg text-center text-body-sm text-on-surface-variant">Your entries will appear here.</p>}</section>
        <section className="mb-8 rounded-[24px] bg-surface-container-lowest p-lg cloud-shadow"><div className="mb-md flex items-center justify-between"><h2 className="text-label-lg text-on-surface-variant">Friends</h2><Link to="/friends" className="text-label-lg text-primary">Manage</Link></div><div className="space-y-sm">{(profile.friends || []).slice(0, 5).map((friend) => <Link key={friend.id} to={`/profile/${friend.id}`} className="flex items-center gap-sm rounded-xl p-xs transition-colors hover:bg-surface-container-low active:bg-surface-container"><Avatar user={friend} /><div><p className="text-body-md font-semibold text-on-surface">{friend.display_name || friend.username}</p><p className="text-label-sm text-on-surface-variant">@{friend.username}</p></div></Link>)}</div>{profile.friends?.length === 0 && <p className="text-body-sm text-on-surface-variant">Add friends to share your days.</p>}</section>
        <section className="rounded-[24px] bg-surface-container-lowest p-lg cloud-shadow"><h2 className="mb-md text-label-lg text-on-surface-variant">App settings</h2><div className="flex items-center justify-between border-t border-surface-container-low py-sm"><span className="flex items-center gap-sm text-body-md text-on-surface"><span className="material-symbols-outlined text-on-surface-variant">palette</span>Dark theme</span><ThemeToggle /></div></section>
      </>}
    </div><BottomNav />
  </main>
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle dark mode"
      onClick={toggleTheme}
      className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full p-1 transition-colors duration-300 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        isDark ? 'bg-primary' : 'bg-surface-container-highest'
      }`}
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full bg-surface-container-lowest shadow-md transition-transform duration-300 ease-in-out ${
          isDark ? 'translate-x-6 text-on-primary-container' : 'translate-x-0 text-on-surface-variant'
        }`}
      >
        <span className="material-symbols-outlined text-[16px]">
          {isDark ? 'dark_mode' : 'light_mode'}
        </span>
      </span>
    </button>
  )
}

function Avatar({ user, large = false }) {
  const classes = large
    ? 'h-[112px] w-[112px] text-headline-lg border-4 border-surface-container-highest cloud-shadow'
    : 'h-10 w-10 text-body-md'
  const initials = (user.display_name || user.username)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  if (user.avatar_url) {
    return <span className={`${classes} shrink-0 overflow-hidden rounded-full`}><img src={user.avatar_url} alt="" className="h-full w-full object-cover" /></span>
  }

  return <span className={`flex ${classes} shrink-0 items-center justify-center rounded-full bg-secondary-container font-semibold text-secondary`}>{initials}</span>
}
function formatDate(value) { return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
