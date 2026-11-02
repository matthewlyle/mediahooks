import { expect, test } from "bun:test";
import { explain, matches, type Filters } from "./filters.ts";
import { ALL_EVENTS, type PlexPayload } from "./types.ts";

const hook = (filters: Partial<Filters>): Filters => ({ events: [ALL_EVENTS], users: [], libraries: [], ...filters });

const play: PlexPayload = {
  event: "media.play",
  Account: { id: 42, title: "Matt" },
  Metadata: { title: "Pilot", librarySectionTitle: "TV Shows", librarySectionID: 2 },
};

test("all events + empty user/library filters match everything, including admin events", () => {
  expect(matches(hook({}), play)).toBe(true);
  expect(matches(hook({}), { event: "admin.database.backup" })).toBe(true);
});

test("event filter excludes other events", () => {
  expect(matches(hook({ events: ["media.play"] }), play)).toBe(true);
  expect(matches(hook({ events: ["media.stop"] }), play)).toBe(false);
});

test("user filter matches title case-insensitively or numeric id", () => {
  expect(matches(hook({ users: ["matt"] }), play)).toBe(true);
  expect(matches(hook({ users: ["42"] }), play)).toBe(true);
  expect(matches(hook({ users: ["someone"] }), play)).toBe(false);
});

test("library filter matches title or section id", () => {
  expect(matches(hook({ libraries: ["tv shows"] }), play)).toBe(true);
  expect(matches(hook({ libraries: ["2"] }), play)).toBe(true);
  expect(matches(hook({ libraries: ["Movies"] }), play)).toBe(false);
});

test("non-empty library filter rejects playback payloads without Metadata", () => {
  expect(explain(hook({ libraries: ["TV Shows"] }), { event: "media.play" })).toBe("the event has no library");
});

test("user and library filters apply only where the sentence shows them", () => {
  const elsewhere = { ...play, Account: { id: 9, title: "someone" }, Metadata: { librarySectionTitle: "Movies", librarySectionID: 1 } };
  const byUser = hook({ users: ["Matt"] });
  const byLibrary = hook({ libraries: ["TV Shows"] });
  for (const event of ["library.new", "playback.started", "admin.database.backup", "admin.database.corrupted", "device.new"]) {
    expect(explain(byUser, { ...elsewhere, event }), event).toBeNull();
  }
  for (const event of ["playback.started", "admin.database.backup", "admin.database.corrupted", "device.new"]) {
    expect(explain(byLibrary, { ...elsewhere, event }), event).toBeNull();
  }
  expect(explain(byUser, { ...elsewhere, event: "library.on.deck" })).toBe("user someone isn't in its users");
  expect(explain(byLibrary, { ...elsewhere, event: "library.new" })).toBe("library Movies isn't in its libraries");
});
