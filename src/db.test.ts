import { expect, test } from "bun:test";
import { openDb } from "./db.ts";

test("a burst of one kind keeps the 100 newest events plus the newest of every other kind", () => {
  const db = openDb(":memory:");
  db.recordEvent({ event: "library.new", Metadata: { type: "episode", title: "Pilot" } }, [], null);
  db.recordEvent({ event: "media.play", Metadata: { type: "track", title: "Song" } }, [], null);
  db.recordEvent({ event: "admin.database.backup" }, [], null);
  for (let i = 1; i <= 150; i++) db.recordEvent({ event: "library.new", Metadata: { type: "movie", title: `Film ${i}` } }, [], null);

  const titles = db.listEvents().map((e) => e.payload.Metadata?.title ?? e.payload.event);
  expect(titles).toHaveLength(102);
  expect(titles.slice(0, 100)).toEqual(Array.from({ length: 100 }, (_, i) => `Film ${150 - i}`));
  expect(titles.slice(100)).toEqual(["Song", "Pilot"]);
});
