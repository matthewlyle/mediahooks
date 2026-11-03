import { ALL_EVENTS, type Webhook } from "../../src/types.ts";

type Option = readonly [id: string, phrase: string];
export type Slot = "who" | "what" | "where";
type Group = { name: string; options: Option[] };

const PLAYBACK: Option[] = [
  ["media.play", "starts"],
  ["media.pause", "pauses"],
  ["media.resume", "resumes"],
  ["media.stop", "stops"],
  ["media.scrobble", "finishes"],
  ["media.rate", "rates"],
];
const LIBRARY: Option[] = [
  ["library.new", "adds something new"],
  ["library.on.deck", "puts something on deck"],
];
const SERVER: Option[] = [
  ["admin.database.backup", "a database backup runs"],
  ["admin.database.corrupted", "the database is corrupted"],
  ["device.new", "a new device connects"],
  ["playback.started", "playback starts server-wide"],
];
const KNOWN = new Set([...PLAYBACK, ...LIBRARY, ...SERVER].map(([id]) => id));

const HAPPENED: Record<string, string> = {
  "media.play": "Started",
  "media.pause": "Paused",
  "media.resume": "Resumed",
  "media.stop": "Stopped",
  "media.scrobble": "Finished",
  "media.rate": "Rated",
  "library.new": "New item",
  "library.on.deck": "On deck",
  "admin.database.backup": "Database backup",
  "admin.database.corrupted": "Database corrupted",
  "device.new": "New device",
  "playback.started": "Playback started",
};

export function eventWords(id: string): string {
  return HAPPENED[id] ?? id;
}

function joinOr(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} or ${items.at(-1)}`;
}

function summarize(items: string[], none: string, others: (n: number) => string, keep = 2): string {
  if (items.length === 0) return none;
  const full = joinOr(items);
  if (items.length <= keep || (items.length === keep + 1 && full.length <= 44)) return full;
  return `${items.slice(0, keep).join(", ")} or ${others(items.length - keep)}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function eventGroups(available: string[]): Group[] {
  return [
    { name: "Playback", options: PLAYBACK.filter(([id]) => available.includes(id)) },
    { name: "Library", options: LIBRARY.filter(([id]) => available.includes(id)) },
    {
      name: "Server",
      options: [
        ...SERVER.filter(([id]) => available.includes(id)),
        ...available.filter((id) => !KNOWN.has(id)).map((id): Option => [id, id]),
      ],
    },
  ];
}

export type Part =
  | { kind: "words"; key: string; text: string }
  | { kind: "space"; key: string }
  | { kind: "token"; key: string; slot: Slot; text: string; full: string; suffix: string; first: boolean };

type SentenceInput = {
  available: string[];
  allEvents: boolean;
  events: string[];
  users: string[];
  libraries: string[];
};

const ADDED = "library.new";

export function sentenceParts({ available, allEvents, events, users, libraries }: SentenceInput): Part[] {
  const groups = eventGroups(available);
  const chosen = (list: Option[]) => list.filter(([id]) => events.includes(id)).map(([, phrase]) => phrase);
  const playback = allEvents ? [] : chosen(groups[0]!.options);
  const library = allEvents ? [] : chosen(groups[1]!.options.filter(([id]) => id !== ADDED));
  const added = !allEvents && events.includes(ADDED) && available.includes(ADDED);
  const server = allEvents ? [] : chosen(groups[2]!.options);
  const subject = [...playback, ...library];

  const what = (
    key: string,
    items: string[],
    fallback: string,
    others: (n: number) => string,
    keep: number,
    suffix: string,
    first: boolean,
  ): Part => ({
    kind: "token",
    key,
    slot: "what",
    text: summarize(items, fallback, others, keep),
    full: items.length ? joinOr(items) : fallback,
    suffix,
    first,
  });
  const where = (suffix: string): Part => ({
    kind: "token",
    key: "where",
    slot: "where",
    text: summarize(libraries, "any library", (n) => plural(n, "other library", "other libraries")),
    full: libraries.length ? joinOr(libraries) : "any library",
    suffix,
    first: false,
  });
  const otherServerEvents = (n: number) => plural(n, "other server event", "other server events");
  const otherThings = (n: number) => `does ${plural(n, "other thing", "other things")}`;
  const subjectCut = summarize(subject, "", otherThings) !== joinOr(subject);
  const pushServer = () => {
    if (server.length === 0) return;
    if (parts.at(-1)?.kind !== "words") parts.push({ kind: "space", key: "s3" });
    parts.push({ kind: "words", key: "orwhen", text: "or when" }, what("server", server, "", otherServerEvents, 1, ".", false));
  };

  const parts: Part[] = [{ kind: "words", key: "send", text: "Send when" }];
  if (!allEvents && subject.length === 0 && !added && server.length > 0) {
    parts.push(what("what", server, "", otherServerEvents, 1, ".", true));
    return parts;
  }
  if (!allEvents && subject.length === 0 && added) {
    parts.push(
      what("what", ["something new is added"], "", otherThings, 1, "", true),
      { kind: "space", key: "s1" },
      { kind: "words", key: "to", text: "to" },
      where(server.length > 0 ? "," : "."),
    );
    pushServer();
    return parts;
  }
  parts.push(
    {
      kind: "token",
      key: "who",
      slot: "who",
      text: summarize(users, "anyone", (n) => plural(n, "other", "others")),
      full: users.length ? joinOr(users) : "anyone",
      suffix: "",
      first: false,
    },
    { kind: "space", key: "s1" },
    what("what", allEvents ? [] : subject, allEvents ? "does anything" : "does what", otherThings, 2, "", true),
    { kind: "space", key: "s2" },
    {
      kind: "words",
      key: "tail",
      text: playback.length > 0 && library.length === 0 && !subjectCut ? "something in" : "in",
    },
    where(added || server.length > 0 ? "," : "."),
  );
  if (added) {
    parts.push(
      { kind: "space", key: "s4" },
      { kind: "words", key: "orwhenadded", text: "or when" },
      what("added", ["something new is added"], "", otherThings, 1, libraries.length > 0 ? "" : server.length > 0 ? "," : ".", false),
    );
    if (libraries.length > 0) parts.push({ kind: "space", key: "s5" }, { kind: "words", key: "there", text: server.length > 0 ? "there," : "there." });
  }
  pushServer();
  return parts;
}

export function webhookParts(w: Pick<Webhook, "events" | "users" | "libraries">): Part[] {
  const allEvents = w.events.includes(ALL_EVENTS);
  return sentenceParts({
    available: [...KNOWN, ...w.events.filter((id) => id !== ALL_EVENTS && !KNOWN.has(id))],
    allEvents,
    events: allEvents ? [] : w.events,
    users: w.users,
    libraries: w.libraries,
  });
}
