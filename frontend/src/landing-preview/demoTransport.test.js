import assert from "node:assert/strict";
import test from "node:test";
import { createDemoFetch } from "./demoTransport.js";

const options = { now: new Date(2026, 10, 6, 12), language: "ru" };

test("demo mutations affect only their own in-memory journal", async () => {
  const first = createDemoFetch(options);
  const second = createDemoFetch(options);
  await first("https://api.example/entries", { method: "POST", body: JSON.stringify({ date: "2026-11-06", mood: 1, text: "Demo edit", tags: [] }) });
  const read = async (fetch) => (await fetch("https://api.example/entries/me?date=2026-11-06")).json();
  assert.equal((await read(first)).mood, 1);
  assert.equal((await read(second)).mood, 4);
  const persisted = await (await first("https://api.example/entries/demo-2026-11-06/visibility", { method: "PATCH", body: JSON.stringify({ is_hidden: true }) })).json();
  assert.equal(persisted.is_hidden, true);
  assert.equal((await read(second)).is_hidden, false);
});

test("demo responses cannot change authentication tokens or forward unsupported actions", async () => {
  const fetch = createDemoFetch(options);
  for (const path of ["/auth/logout", "/auth/password", "/storage/entry-photos/upload/real-token", "/users/me/export"]) {
    const response = await fetch(`https://api.example${path}`, { method: "POST" });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("X-CSRF-Token"), null);
  }
  const session = await (await fetch("https://api.example/auth/session")).json();
  assert.equal(session.user.id, "demo-user");
  assert.equal(session.csrf_token, undefined);
});

test("calendar stays consistent after saving and deleting a demo entry", async () => {
  const fetch = createDemoFetch(options);
  await fetch("/entries/demo-2026-11-06", { method: "DELETE" });
  assert.equal((await fetch("/entries/me?date=2026-11-06")).status, 404);
  const month = await (await fetch("/entries/me?month=2026-11")).json();
  const summary = await (await fetch("/entries/summary?month=2026-11")).json();
  assert.equal(summary.entry_count, month.length);
  assert.ok(month.every(entry => entry.date.startsWith("2026-11") && entry.date !== "2026-11-06"));
});

test("feed and profile show the demo friends and their natural posts", async () => {
  const fetch = createDemoFetch(options);
  const feed = await (await fetch("/feed?limit=10&include_self=false")).json();
  const profile = await (await fetch("/users/me")).json();
  assert.equal(feed.items.length, 6);
  assert.equal(new Set(feed.items.map((entry) => entry.author.id)).size, 2);
  assert.match(feed.items[0].text, /кофейне у парка|посидеть и поговорить|ужин/);
  assert.equal(profile.friends.length, 2);
  assert.equal(profile.recent_entries.length, 5);
});
