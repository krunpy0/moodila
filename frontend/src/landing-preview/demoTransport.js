// This transport belongs exclusively to landing-preview.html. It never forwards requests.
export function createDemoFetch({ now = new Date(), language = "en" } = {}) {
  const dateKey = (date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  const today = dateKey(now);
  const entries = new Map();
  const sampleText = language === "ru"
    ? "Долго гуляли, болтали обо всём. Хочется запомнить этот день."
    : "A long walk and a conversation about everything. A day worth remembering.";
  const user = { id: "demo-user", username: "alex", display_name: language === "ru" ? "Саша" : "Alex", is_verified: true };
  for (let offset = 0; offset < 20; offset++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    const key = dateKey(date);
    entries.set(key, { id: `demo-${key}`, user_id: user.id, date: key, mood: [4, 3, 5, 4, 2, 4, 5][offset % 7], tags: ["Calm", "Grateful"], text: sampleText, is_hidden: false, photo_url: null, audio_url: null, friend_overrides: [] });
  }
  const friends = [
    { id: "demo-friend-1", username: "mira", display_name: language === "ru" ? "Мира" : "Mira", hide_by_default: false },
    { id: "demo-friend-2", username: "leo", display_name: language === "ru" ? "Лёва" : "Leo", hide_by_default: false },
  ];
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  return async (input, options = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url, "https://demo.invalid");
    const path = url.pathname;
    const method = (options.method || "GET").toUpperCase();
    const body = typeof options.body === "string" ? JSON.parse(options.body) : {};
    if (path === "/app/features" || path === "/features") return json({ active_seasonal_themes: ["sakura"], seasonal_themes: [] });
    if (path === "/auth/session") return json({ user_id: user.id, user });
    if (path === "/users/me") return json({ user, entry_count: entries.size });
    if (path === "/friends" || path === "/friends/visibility-defaults") return json(friends);
    if (path === "/notifications/unread-count") return json({ unread_count: 0 });
    if (path === "/announcements/active-prompt") return json(null);
    if (["/announcements/inbox", "/announcements/unread", "/notifications", "/friends/pending"].includes(path)) return json([]);
    if (path === "/notifications/settings") return json({ locale: language });
    if (path === "/entries/summary") {
      const list = [...entries.values()].filter(entry => entry.date.startsWith(url.searchParams.get("month") || today.slice(0, 7)));
      return json({ entry_count: list.length, dominant_mood: 4, top_tag: "Calm" });
    }
    if (path === "/entries/me") {
      const date = url.searchParams.get("date");
      if (date) return entries.has(date) ? json(entries.get(date)) : json({ error: "No entry" }, 404);
      return json([...entries.values()].filter(entry => entry.date.startsWith(url.searchParams.get("month") || today.slice(0, 7))));
    }
    if (path.startsWith("/entries/friend/")) return json([...entries.values()]);
    if (path === "/entries" && method === "POST") {
      const entry = { ...entries.get(body.date), ...body, id: `demo-${body.date}`, user_id: user.id };
      entries.set(body.date, entry);
      return json(entry);
    }
    if (/^\/entries\/[^/]+\/visibility$/.test(path) && method === "PATCH") {
      const id = decodeURIComponent(path.split("/")[2]);
      const entry = [...entries.values()].find(item => item.id === id);
      if (!entry) return json({ error: "No entry" }, 404);
      entry.is_hidden = Boolean(body.is_hidden);
      return json(entry);
    }
    if (path.startsWith("/entries/") && method === "DELETE") {
      const id = decodeURIComponent(path.split("/")[2]);
      for (const [key, entry] of entries) if (entry.id === id || entry.date === id) entries.delete(key);
      return new Response(null, { status: 204 });
    }
    return json({ error: language === "ru" ? "Это демонстрация. Эта функция доступна в вашем дневнике." : "This is a demo. This feature is available in your own journal." }, 403);
  };
}
