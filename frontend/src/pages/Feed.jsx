/* Hallmark · designed-as-app · design-system: DESIGN.md · genre: editorial */
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams, useLocation } from "react-router-dom";
import {
  useInfiniteFeedQuery,
  useLikeEntryMutation,
  useCommentsQuery,
  useAddCommentMutation,
  useDeleteCommentMutation,
  useProfileQuery,
  useFriendsQuery,
} from "../api/queries";
import AppLayout from "../components/AppLayout";
import BottomNav from "../components/BottomNav";
import HeaderBell from "../components/HeaderBell";
import { useNotifications } from "../components/Notifications";
import { FeedSkeleton, FeedCardSkeleton, CommentsSkeleton } from "../components/skeleton/PageSkeletons";
import VoiceNotePlayer from "../components/VoiceNotePlayer";
import ImageWithSkeleton from "../components/ImageWithSkeleton";
import MoodIcon from "../components/MoodIcon";
import { getMoodInfo, getLocalizedTag } from "../utils/moods";
import { useLanguage } from "../context/LanguageContext";
import { getLocalDate } from "../api/client";
import ReactionsModal from "../components/ReactionsModal";
import ReactionIcon from "../components/ReactionIcon";
import { haptics } from "../utils/haptics";

const emojiReactions = ["❤️", "👏", "💡", "😁", "🔥"];

export default function Feed() {
  const [includeSelf, setIncludeSelf] = useState(() => {
    try {
      return localStorage.getItem("moodshare_feed_include_self") === "true";
    } catch {
      return false;
    }
  });

  const feedQuery = useInfiniteFeedQuery(10, includeSelf);
  const friendsQuery = useFriendsQuery();
  const likeMutation = useLikeEntryMutation();
  const observerRef = useRef(null);
  const { t } = useLanguage();
  const { notify } = useNotifications();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const targetEntryId = searchParams.get("entry");
  const scrolledTargetKeyRef = useRef(null);

  const friends = friendsQuery.data || [];

  const handleToggleIncludeSelf = () => {
    haptics.selection();
    setIncludeSelf((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("moodshare_feed_include_self", String(next));
      } catch {
        // Storage restriction fallback
      }
      return next;
    });
  };

  const entries = feedQuery.data
    ? feedQuery.data.pages.flatMap((page) => page.items || page.entries || [])
    : [];

  useEffect(() => {
    if (!targetEntryId) {
      scrolledTargetKeyRef.current = null;
      return;
    }

    const navigationKey = `${location.key}:${targetEntryId}`;
    if (scrolledTargetKeyRef.current === navigationKey) {
      return;
    }

    if (entries.length > 0) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`feed-entry-${targetEntryId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          scrolledTargetKeyRef.current = navigationKey;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [targetEntryId, entries, location.key]);

  const fetchNextPage = feedQuery.fetchNextPage;
  const hasNextPage = feedQuery.hasNextPage;
  const isFetchingNextPage = feedQuery.isFetchingNextPage;

  const fetchNextPageRef = useRef(fetchNextPage);
  const canFetchRef = useRef(!isFetchingNextPage && hasNextPage);

  useEffect(() => {
    fetchNextPageRef.current = fetchNextPage;
    canFetchRef.current = Boolean(!isFetchingNextPage && hasNextPage);
  });

  useEffect(() => {
    const target = observerRef.current;
    if (!target || !hasNextPage) return;

    let debounceTimer = null;

    const observer = new IntersectionObserver(
      (observerEntries) => {
        if (observerEntries[0]?.isIntersecting && canFetchRef.current) {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            if (canFetchRef.current) {
              fetchNextPageRef.current();
            }
          }, 200);
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(target);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      observer.disconnect();
    };
  }, [hasNextPage]);

  const handleReact = (entryId, reaction) => {
    haptics.impact();
    likeMutation.mutate(
      { entryId, reaction },
      {
        onError: (err) => {
          haptics.error();
          notify(err.message, "error");
        },
      },
    );
  };

  return (
    <AppLayout>
      <main className="mx-auto min-h-screen w-full max-w-md lg:max-w-6xl xl:max-w-7xl bg-background pb-32 lg:pb-12 text-on-background px-0 lg:px-6 py-0 lg:py-6">
        <header className="flex items-center justify-between px-container-margin py-md lg:px-0">
          <div>
            <h1 className="text-headline-xl font-headline-xl text-on-surface">
              {t("feed.title")}
            </h1>
            <p className="mt-xs text-body-sm text-on-surface-variant">
              {t("feed.emptySubtitle")}
            </p>
          </div>
          <div className="lg:hidden">
            <HeaderBell />
          </div>
        </header>

        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
          {/* Main Feed Column */}
          <div className="lg:col-span-8 space-y-md">
            <section className="px-container-margin lg:px-0 pb-xs">
              <div className="flex items-center justify-between rounded-md bg-surface-container-lowest p-md border border-outline-variant/20">
                <div className="flex items-center gap-sm">
                  <span className="material-symbols-outlined text-[22px] text-primary">
                    {includeSelf ? "person" : "group"}
                  </span>
                  <div>
                    <span className="block text-body-sm font-semibold text-on-surface">
                      {t("feed.includeMyPosts")}
                    </span>
                    <span className="block text-label-sm text-on-surface-variant">
                      {t("feed.includeMyPostsDesc")}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={includeSelf}
                  aria-label={t("feed.includeMyPosts")}
                  onClick={handleToggleIncludeSelf}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-normal ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                    includeSelf ? "bg-primary" : "bg-surface-container-highest"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full bg-surface-container-lowest shadow-sm transition-transform duration-normal ease-standard ${
                      includeSelf
                        ? "translate-x-5 text-on-primary-container"
                        : "translate-x-0 text-on-surface-variant"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {includeSelf ? "check" : "close"}
                    </span>
                  </span>
                </button>
              </div>
            </section>

            <section
              className="space-y-md px-container-margin lg:px-0 pt-sm"
              aria-live="polite"
            >
              {feedQuery.isLoading ? (
                <FeedSkeleton />
              ) : (
                <>
                  {entries.map((entry) => (
                    <FeedCard
                      key={entry.id}
                      entry={entry}
                      onReact={handleReact}
                      isHighlighted={entry.id === targetEntryId}
                    />
                  ))}

                  {hasNextPage && (
                    <div ref={observerRef} className="py-md">
                      {isFetchingNextPage ? (
                        <FeedCardSkeleton />
                      ) : (
                        <p className="text-center text-body-sm text-on-surface-variant">
                          {t("common.seeMore")}
                        </p>
                      )}
                    </div>
                  )}

                  {!feedQuery.isLoading &&
                    !feedQuery.isError &&
                    entries.length === 0 && (
                      <div className="rounded-lg bg-surface-container-lowest p-lg sm:p-xl border border-outline-variant/20 shadow-card relative overflow-hidden">
                        <div className="flex items-start gap-md">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-container text-on-primary-container">
                            <span className="material-symbols-outlined text-[26px] text-primary">
                              auto_stories
                            </span>
                          </div>
                          <div className="flex-1 min-w-0 space-y-xs">
                            <h2 className="text-headline-sm font-bold text-on-surface tracking-tight">
                              {t("feed.welcomeTitle")}
                            </h2>
                            <p className="text-body-sm leading-relaxed text-on-surface-variant max-w-lg">
                              {t("feed.welcomeDesc")}
                            </p>
                            <div className="flex flex-wrap items-center gap-sm pt-md">
                              <Link
                                to="/entries/new"
                                className="inline-flex items-center gap-xs rounded-full bg-primary px-lg py-sm text-label-md font-semibold text-on-primary shadow-xs hover:opacity-90 active:scale-95 transition-[background-color,transform,opacity] duration-normal ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                              >
                                <span className="material-symbols-outlined text-[18px]">edit_note</span>
                                <span>{t("home.firstEntryBtn")}</span>
                              </Link>
                              <Link
                                to="/friends"
                                className="inline-flex items-center gap-xs rounded-full bg-surface-container px-lg py-sm text-label-md font-semibold text-on-surface hover:bg-surface-container-high active:scale-95 transition-[background-color,transform] duration-normal ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                              >
                                <span className="material-symbols-outlined text-[18px]">person_add</span>
                                <span>{t("feed.addFriendsBtn")}</span>
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                </>
              )}
              {feedQuery.isError && (
                <p
                  role="alert"
                  className="py-lg text-center text-body-sm text-error"
                >
                  {feedQuery.error.message}
                </p>
              )}
            </section>
          </div>

          {/* Right Sidebar Column on Desktop */}
          <div className="hidden lg:block lg:col-span-4 space-y-md">
            <div className="sticky top-6 rounded-lg bg-surface-container-lowest p-lg border border-outline-variant/20 space-y-md">
              <div className="flex items-center justify-between border-b border-outline-variant/20 pb-sm">
                <h3 className="text-headline-sm font-bold text-on-surface">
                  {t("feed.friendsSidebarTitle")}
                </h3>
                <Link
                  to="/friends"
                  className="text-label-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xs"
                >
                  {t("common.seeAll")}
                </Link>
              </div>

              {friends.length > 0 ? (
                <div className="space-y-xs">
                  {friends.slice(0, 5).map((friend) => (
                    <Link
                      key={friend.id}
                      to={`/calendar?friend=${friend.id}`}
                      className="flex items-center justify-between p-sm rounded-md hover:bg-surface-container-low transition-colors duration-fast group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <div className="flex items-center gap-sm min-w-0">
                        {friend.avatar_url ? (
                          <img
                            src={friend.avatar_url}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-primary/20"
                          />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-container font-semibold text-secondary text-body-sm">
                            {(friend.display_name ||
                              friend.username)[0].toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-body-sm font-semibold text-on-surface truncate group-hover:text-primary transition-colors duration-fast">
                            {friend.display_name || friend.username}
                          </p>
                          <p className="text-label-sm text-on-surface-variant truncate">
                            @{friend.username}
                          </p>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-[18px] text-on-surface-variant/40 group-hover:text-primary transition-colors duration-fast">
                        calendar_month
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-4 text-center">
                  <p className="text-body-sm text-on-surface-variant">
                    {t("feed.noFriendsYet")}
                  </p>
                  <Link
                    to="/friends"
                    className="mt-xs inline-block text-label-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xs"
                  >
                    {t("feed.findFriends")}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
        <BottomNav />
      </main>
    </AppLayout>
  );
}

const moodTintBg = {
  1: "bg-mood-awful-container/40 border-mood-awful/20",
  2: "bg-mood-bad-container/40 border-mood-bad/20",
  3: "bg-mood-meh-container/40 border-mood-meh/20",
  4: "bg-mood-good-container/40 border-mood-good/20",
  5: "bg-mood-rad-container/40 border-mood-rad/20",
};

function FeedCard({ entry, onReact, isHighlighted = false }) {
  const [showComments, setShowComments] = useState(isHighlighted);

  useEffect(() => {
    if (isHighlighted) {
      setShowComments(true);
    }
  }, [isHighlighted]);

  const { t, dateLocale } = useLanguage();

  const profileQuery = useProfileQuery();
  const currentUserId = profileQuery.data?.user?.id;
  const moodInfo = getMoodInfo(entry.mood, t);
  const authorName = entry.author.display_name || entry.author.username;
  const profileLink =
    currentUserId && entry.author?.id === currentUserId
      ? "/profile"
      : `/profile/${entry.author.id}`;

  const hasText = !!entry.text;
  const hasPhoto = !!entry.photo_url;
  const hasAudio = !!entry.audio_url;
  const hasTags = entry.tags && entry.tags.length > 0;
  const isMoodOnly = !hasText && !hasPhoto && !hasAudio;

  if (isMoodOnly) {
    return (
      <article
        id={`feed-entry-${entry.id}`}
        className={`rounded-xl lg:rounded-xxl p-lg shadow-card border transition-[background-color,border-color,box-shadow] duration-normal ${moodTintBg[entry.mood] || "bg-surface-container-high/50 border-outline-variant/20"} ${
          isHighlighted ? "ring-2 ring-primary shadow-floating" : ""
        }`}
      >
        <header className="flex items-center gap-sm">
          <Link
            to={profileLink}
            className="flex min-w-0 flex-1 items-center gap-sm transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
          >
            <Avatar author={entry.author} />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-body-md font-semibold text-on-surface">
                {authorName}
              </h2>
              <p className="text-label-sm text-on-surface-variant">
                @{entry.author.username} ·{" "}
                <span className="tabular-nums">
                  {formatFeedDate(entry.created_at, entry.date, t, dateLocale)}
                </span>
              </p>
            </div>
          </Link>
        </header>

        <div className="mt-md flex flex-col items-center gap-sm py-sm">
          <span
            className={`flex h-16 w-16 items-center justify-center rounded-full ${moodInfo.bg}`}
          >
            <MoodIcon mood={entry.mood} className="text-[36px]" />
          </span>
          <span
            className={`rounded-full px-md py-xs text-label-lg font-bold ${moodInfo.bg} ${moodInfo.onContainer || "text-on-surface"}`}
          >
            {moodInfo.label}
          </span>
          {hasTags && (
            <div className="mt-xs flex flex-wrap justify-center gap-xs">
              {entry.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-surface-container-lowest/70 px-sm py-xs text-label-sm text-on-surface-variant"
                >
                  {getLocalizedTag(tag, t)}
                </span>
              ))}
            </div>
          )}
        </div>

        <footer className="relative mt-sm border-t border-surface-container pt-sm">
          <ReactionsSection
            entry={entry}
            onReact={onReact}
            showComments={showComments}
            setShowComments={setShowComments}
          />
        </footer>

        {showComments && (
          <CommentsSection
            entryId={entry.id}
            postAuthorId={entry.author?.id}
          />
        )}
      </article>
    );
  }

  return (
    <article
      id={`feed-entry-${entry.id}`}
      className={`rounded-xl lg:rounded-xxl bg-surface-container-lowest border border-outline-variant/20 p-lg shadow-card transition-[box-shadow,border-color] duration-normal ${
        isHighlighted ? "ring-2 ring-primary shadow-floating" : ""
      }`}
    >
      <header className="flex items-center gap-sm">
        <Link
          to={profileLink}
          className="flex min-w-0 flex-1 items-center gap-sm transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
        >
          <Avatar author={entry.author} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-body-md font-semibold text-on-surface">
              {authorName}
            </h2>
            <p className="text-label-sm text-on-surface-variant">
              @{entry.author.username} ·{" "}
              <span className="tabular-nums">
                {formatFeedDate(entry.created_at, entry.date, t, dateLocale)}
              </span>
            </p>
          </div>
        </Link>
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-full ${moodInfo.bg}`}
          title={moodInfo.label}
        >
          <MoodIcon mood={entry.mood} className="text-[24px]" />
        </span>
      </header>

      <div className="mt-md space-y-sm">
        <div className="flex flex-wrap gap-xs">
          <span
            className={`rounded-full px-sm py-xs text-label-sm font-semibold ${moodInfo.bg} ${moodInfo.onContainer || "text-on-surface"}`}
          >
            {moodInfo.label}
          </span>
          {entry.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-surface-container-low px-sm py-xs text-label-sm text-on-surface-variant"
            >
              {getLocalizedTag(tag, t)}
            </span>
          ))}
        </div>
        {hasText && (
          <p className="whitespace-pre-wrap text-body-md leading-6 text-on-surface">
            {entry.text}
          </p>
        )}
        {hasPhoto && (
          <div className="overflow-hidden rounded-2xl bg-surface-container-high">
            <ImageWithSkeleton
              src={entry.photo_url}
              alt={t("feed.photoAlt", { name: authorName })}
              className="w-full max-h-[480px] sm:max-h-[520px] object-cover"
              skeletonHeightClass="h-64 sm:h-80"
              loading="lazy"
            />
          </div>
        )}
        {hasAudio && (
          <VoiceNotePlayer
            audioUrl={entry.audio_url}
            duration={entry.audio_duration}
            className="mt-sm"
          />
        )}
      </div>

      <footer className="relative mt-md border-t border-surface-container pt-sm">
        <ReactionsSection
          entry={entry}
          onReact={onReact}
          showComments={showComments}
          setShowComments={setShowComments}
        />
      </footer>

      {showComments && (
        <CommentsSection
          entryId={entry.id}
          postAuthorId={entry.author?.id}
        />
      )}
    </article>
  );
}

function ReactionsSection({ entry, onReact, showComments, setShowComments }) {
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [reactionsModalOpen, setReactionsModalOpen] = useState(false);
  const pickerRef = useRef(null);
  const { t } = useLanguage();

  useEffect(() => {
    if (!emojiPickerOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setEmojiPickerOpen(false);
      }
    };

    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setEmojiPickerOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [emojiPickerOpen]);

  const reactions = entry.reactions || [];
  const myReactions =
    entry.my_reactions || (entry.my_reaction ? [entry.my_reaction] : []);
  const totalCount = entry.like_count || 0;

  return (
    <>
      {emojiPickerOpen && (
        <div
          ref={pickerRef}
          role="toolbar"
          aria-label={t("reactions.title")}
          className="absolute -top-12 left-0 z-20 flex items-center gap-xs rounded-full bg-surface-container-high p-1 shadow-floating border border-outline-variant/30 animate-in fade-in zoom-in-95"
        >
          {emojiReactions.map((reac) => {
            const isMine = myReactions.includes(reac);
            return (
              <button
                key={reac}
                type="button"
                onClick={() => {
                  haptics.impact();
                  onReact(entry.id, reac);
                  setEmojiPickerOpen(false);
                }}
                className={`flex h-9 w-9 items-center justify-center rounded-full transition-[background-color,transform] duration-fast ease-out hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isMine
                    ? "bg-primary-container/70 ring-1 ring-primary/30"
                    : "hover:bg-surface-container-low"
                }`}
              >
                <ReactionIcon reaction={reac} className="text-[20px]" />
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between gap-sm">
        <div className="flex items-center gap-xs min-w-0 flex-1 overflow-x-auto scrollbar-none py-0.5">
          {reactions.length > 0 ? (
            reactions.map((r) => (
              <ReactionChip
                key={r.reaction}
                reactionItem={r}
                onToggle={() => onReact(entry.id, r.reaction)}
                onLongPress={() => setReactionsModalOpen(true)}
              />
            ))
          ) : (
            <button
              type="button"
              onClick={() => {
                haptics.impact();
                onReact(entry.id, "❤️");
              }}
              aria-label="Add reaction"
              className="flex shrink-0 items-center gap-xs rounded-full bg-surface-container-low px-sm py-xs text-label-sm text-on-surface-variant transition-colors duration-fast hover:bg-surface-container active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            >
              <ReactionIcon reaction="❤️" className="text-[18px]" />
              <span>0</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              haptics.selection();
              setEmojiPickerOpen((prev) => !prev);
            }}
            aria-label={t("reactions.title")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant transition-colors duration-fast hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            title={t("reactions.title")}
          >
            <span className="material-symbols-outlined text-[18px]">
              add_reaction
            </span>
          </button>

          {totalCount > 0 && (
            <button
              type="button"
              onClick={() => {
                haptics.selection();
                setReactionsModalOpen(true);
              }}
              className="flex shrink-0 items-center gap-0.5 text-label-sm font-semibold text-on-surface-variant/70 hover:text-primary transition-colors duration-fast px-xs py-0.5 rounded-full hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
              title={t("reactions.longPressHint")}
            >
              <span className="material-symbols-outlined text-[16px]">
                group
              </span>
            </button>
          )}
        </div>

        <button
          type="button"
          aria-expanded={showComments}
          aria-label={t("feed.commentsCount", { count: entry.comment_count || 0 })}
          onClick={() => {
            haptics.selection();
            setShowComments((prev) => !prev);
          }}
          className="flex shrink-0 items-center gap-xs rounded-full bg-surface-container-low px-sm py-xs text-label-sm text-on-surface-variant transition-colors duration-fast hover:bg-surface-container ml-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
        >
          <span className="material-symbols-outlined text-[19px]">
            chat_bubble
          </span>
          <span>
            {t("feed.commentsCount", { count: entry.comment_count || 0 })}
          </span>
        </button>
      </div>

      <ReactionsModal
        entryId={entry.id}
        isOpen={reactionsModalOpen}
        onClose={() => setReactionsModalOpen(false)}
      />
    </>
  );
}

function ReactionChip({ reactionItem, onToggle, onLongPress }) {
  const timerRef = useRef(null);
  const isLongPressRef = useRef(false);
  const { t } = useLanguage();

  const handleStart = () => {
    isLongPressRef.current = false;
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      haptics.heavy();
      if (onLongPress) onLongPress();
    }, 450);
  };

  const handleEnd = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!isLongPressRef.current) {
      haptics.impact();
      onToggle();
    }
  };

  const handleCancel = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  return (
    <button
      type="button"
      onMouseDown={handleStart}
      onMouseUp={handleEnd}
      onMouseLeave={handleCancel}
      onTouchStart={handleStart}
      onTouchEnd={(e) => {
        e.preventDefault();
        handleEnd();
      }}
      onTouchMove={handleCancel}
      title={t("reactions.longPressHint")}
      className={`flex shrink-0 items-center gap-xs rounded-full px-sm py-xs text-label-sm transition-[background-color,transform,color] duration-fast active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
        reactionItem.reacted_by_me
          ? "bg-primary-container text-on-primary-container font-semibold ring-1 ring-primary/30 shadow-xs"
          : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
      }`}
    >
      <ReactionIcon reaction={reactionItem.reaction} className="text-[18px]" />
      <span>{reactionItem.count}</span>
    </button>
  );
}

function CommentsSection({ entryId, postAuthorId }) {
  const [commentText, setCommentText] = useState("");
  const commentsQuery = useCommentsQuery(entryId);
  const addMutation = useAddCommentMutation();
  const deleteMutation = useDeleteCommentMutation();
  const profileQuery = useProfileQuery();
  const { t, dateLocale } = useLanguage();
  const { notify } = useNotifications();
  const currentUserId = profileQuery.data?.user?.id;
  const comments = commentsQuery.data || [];

  const handleSend = (e) => {
    e.preventDefault();
    const trimmed = commentText.trim();
    if (!trimmed || addMutation.isPending) return;
    addMutation.mutate(
      { entryId, text: trimmed },
      {
        onSuccess: () => {
          haptics.success();
          setCommentText("");
        },
        onError: (err) => {
          haptics.error();
          notify(err.message, "error");
        },
      },
    );
  };

  const handleDelete = (commentId) => {
    if (!deleteMutation.isPending) {
      haptics.warning();
      deleteMutation.mutate(
        { commentId, entryId },
        {
          onError: (err) => {
            haptics.error();
            notify(err.message, "error");
          },
        },
      );
    }
  };

  return (
    <div className="mt-md border-t border-surface-container-low pt-md">
      {commentsQuery.isLoading ? (
        <CommentsSkeleton />
      ) : (
        <div className="space-y-md">
          {comments.map((comment) => {
            const isOwner =
              currentUserId &&
              (comment.user_id === currentUserId || postAuthorId === currentUserId);
            const commentAuthor =
              comment.author.display_name || comment.author.username;
            return (
              <div key={comment.id} className="flex items-start gap-sm">
                <Avatar author={comment.author} small />
                <div className="min-w-0 flex-1 rounded-2xl bg-surface-container-low p-sm">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-label-sm font-semibold text-on-surface">
                      {commentAuthor}
                    </span>
                    <span className="text-label-sm text-on-surface-variant/60 tabular-nums">
                      {formatFeedDate(comment.created_at, null, t, dateLocale)}
                    </span>
                  </div>
                  <p className="mt-xs whitespace-pre-wrap text-body-sm text-on-surface">
                    {comment.text}
                  </p>
                </div>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => handleDelete(comment.id)}
                    aria-label={t("common.delete")}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant/50 hover:bg-error-container/30 hover:text-error transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      delete
                    </span>
                  </button>
                )}
              </div>
            );
          })}

          {comments.length === 0 && (
            <p className="py-xs text-center text-body-sm text-on-surface-variant/70">
              {t("feed.addComment")}
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSend} className="mt-md flex items-center gap-xs">
        <input
          type="text"
          value={commentText}
          maxLength={500}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder={t("feed.addComment")}
          className="h-11 flex-1 rounded-full bg-surface-container-low px-md text-body-sm text-on-surface outline-none placeholder:text-on-surface-variant/50 border border-transparent focus-visible:border-outline-variant focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 transition-[border-color,box-shadow] duration-fast"
        />
        <button
          type="submit"
          aria-label={t("feed.sendComment")}
          disabled={!commentText.trim() || addMutation.isPending}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-transform duration-fast active:scale-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
        >
          <span className="material-symbols-outlined text-[18px]">send</span>
        </button>
      </form>
    </div>
  );
}

function Avatar({ author, small = false }) {
  const sizeClass = small ? "h-8 w-8 text-label-sm" : "h-12 w-12 text-label-lg";
  if (author.avatar_url)
    return (
      <img
        src={author.avatar_url}
        alt=""
        className={`${sizeClass} rounded-full object-cover`}
      />
    );
  const initials = (author.display_name || author.username)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full bg-secondary-container font-semibold text-secondary`}
    >
      {initials}
    </span>
  );
}

function parseISO(str) {
  if (!str) return null;
  let s = String(str).trim();
  if (!s.includes("T")) s = s.replace(" ", "T");
  s = s.replace(/([+-]\d{2})$/, "$1:00");
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function getYesterdayDate() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatFeedDate(createdAt, fallbackDate, t, dateLocale) {
  if (!createdAt && !fallbackDate) return "";

  const createdDate = parseISO(createdAt);

  let dateKey = "";
  if (
    fallbackDate &&
    typeof fallbackDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(fallbackDate)
  ) {
    dateKey = fallbackDate;
  } else if (createdDate) {
    dateKey = [
      createdDate.getFullYear(),
      String(createdDate.getMonth() + 1).padStart(2, "0"),
      String(createdDate.getDate()).padStart(2, "0"),
    ].join("-");
  }

  if (!dateKey) return fallbackDate || createdAt || "";

  // Ключ дня, в который запись была реально создана (по created_at)
  let createdKey = "";
  if (createdDate) {
    createdKey = [
      createdDate.getFullYear(),
      String(createdDate.getMonth() + 1).padStart(2, "0"),
      String(createdDate.getDate()).padStart(2, "0"),
    ].join("-");
  }

  const todayStr = getLocalDate();
  const yesterdayStr = getYesterdayDate();

  // Показываем время только если запись помечена той же датой,
  // на которую реально была создана (не задним числом)
  let timeStr = "";
  if (createdDate && createdKey === dateKey) {
    const hours = String(createdDate.getHours()).padStart(2, "0");
    const minutes = String(createdDate.getMinutes()).padStart(2, "0");
    timeStr = `${hours}:${minutes}`;
  }

  let dateStr = "";
  if (dateKey === todayStr) {
    dateStr = t ? t("common.today") : "Today";
  } else if (dateKey === yesterdayStr) {
    dateStr = t ? t("common.yesterday") : "Yesterday";
  } else {
    const [y, m, d] = dateKey.split("-").map(Number);
    const localObj = new Date(y, m - 1, d);
    const locale =
      dateLocale || (t && t("common.today") === "Сегодня" ? "ru-RU" : "en-US");
    dateStr = localObj.toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
    });
  }

  return timeStr ? `${dateStr}, ${timeStr}` : dateStr;
}
