import { ALL_EVENTS, type PlexPayload, type Webhook } from "./types.ts";

export type Filters = Pick<Webhook, "events" | "users" | "libraries">;

function anyEquals(filter: string[], candidates: (string | undefined)[]): boolean {
  const wanted = candidates.filter((c): c is string => c !== undefined).map((c) => c.toLowerCase());
  return filter.some((f) => wanted.includes(f.toLowerCase()));
}

// The "Send when" sentence has no "who" for these, and no "where" for the server events.
const NO_USER_FILTER: Record<string, true> = {
  "library.new": true,
  "playback.started": true,
  "admin.database.backup": true,
  "admin.database.corrupted": true,
  "device.new": true,
};
const NO_LIBRARY_FILTER: Record<string, true> = {
  "playback.started": true,
  "admin.database.backup": true,
  "admin.database.corrupted": true,
  "device.new": true,
};

export function explain(w: Filters, p: PlexPayload): string | null {
  if (!w.events.includes(ALL_EVENTS) && !w.events.includes(p.event)) return `${p.event} isn't one of its events`;

  if (w.users.length > 0 && !Object.hasOwn(NO_USER_FILTER, p.event)) {
    const a = p.Account;
    if (!a) return "the event has no user";
    if (!anyEquals(w.users, [a.title, a.id === undefined ? undefined : String(a.id)])) {
      return `user ${a.title ?? a.id} isn't in its users`;
    }
  }

  if (w.libraries.length > 0 && !Object.hasOwn(NO_LIBRARY_FILTER, p.event)) {
    const m = p.Metadata;
    if (!m) return "the event has no library";
    const id = m.librarySectionID === undefined ? undefined : String(m.librarySectionID);
    if (!anyEquals(w.libraries, [m.librarySectionTitle, id])) {
      return `library ${m.librarySectionTitle ?? id ?? "(unknown)"} isn't in its libraries`;
    }
  }

  return null;
}

export function matches(w: Filters, p: PlexPayload): boolean {
  return explain(w, p) === null;
}
