import { afterAll, expect, test } from "bun:test";
import { PRESETS } from "../public/presets.ts";
import { openDb } from "./db.ts";
import { createDispatcher } from "./dispatch.ts";
import { posterPath } from "./plex.ts";
import { renderBody, renderHeaders, templateVars } from "./template.ts";
import { ALL_EVENTS, PLEX_EVENTS, type PlexPayload } from "./types.ts";

const account = { id: 1, title: "matt" };
const server = { title: "mini", uuid: "srv" };
const player = { local: true, publicAddress: "203.0.113.10", title: "Living Room", uuid: "p1" };
const episode = {
  type: "episode",
  title: "Pilot",
  grandparentTitle: "Show",
  parentIndex: 1,
  index: 1,
  librarySectionID: 2,
  librarySectionTitle: "TV Shows",
  ratingKey: "100",
  thumb: "/ep",
  grandparentThumb: "/show",
};
const movie = { type: "movie", title: "Film", year: 2024, librarySectionID: 1, librarySectionTitle: "Movies", ratingKey: "200", thumb: "/movie" };
const track = {
  type: "track",
  title: "Night Drive",
  grandparentTitle: "Artist",
  parentTitle: "Album",
  index: 4,
  librarySectionID: 3,
  librarySectionTitle: "Music",
  ratingKey: "300",
  thumb: "/track",
  parentThumb: "/album",
  grandparentThumb: "/artist",
};
const album = { type: "album", title: "Album", parentTitle: "Artist", librarySectionTitle: "Music", ratingKey: "301", thumb: "/album" };
const photo = { type: "photo", title: "Beach", parentTitle: "Summer", librarySectionTitle: "Photos", ratingKey: "400", thumb: "/photo" };
const clip = { type: "clip", title: "Trailer", librarySectionTitle: "Movies", ratingKey: "500", thumb: "/clip" };

const media = (event: string, Metadata: PlexPayload["Metadata"]): PlexPayload => ({
  event,
  user: true,
  owner: true,
  Account: account,
  Server: server,
  Player: player,
  Metadata,
});

const EVENTS: PlexPayload[] = [
  media("library.on.deck", episode),
  { event: "library.new", Server: server, Metadata: movie },
  { event: "library.new", Server: server, Metadata: album },
  media("media.play", track),
  media("media.pause", photo),
  media("media.resume", clip),
  { ...media("media.rate", movie), rating: 8 } as PlexPayload,
  media("media.scrobble", track),
  media("media.stop", episode),
  media("playback.started", episode),
  { event: "admin.database.backup", user: true, owner: true, Account: account, Server: server },
  { event: "admin.database.corrupted", user: true, owner: true, Account: account, Server: server },
  { event: "device.new", user: true, owner: true, Account: account, Server: server, Player: player },
];

test("every Plex event has a payload here", () => {
  expect(new Set(EVENTS.map((p) => p.event))).toEqual(new Set(PLEX_EVENTS));
});

test("display_title and poster for each kind of item", () => {
  const kinds: [PlexPayload["Metadata"], string, string | null][] = [
    [episode, "Show S01E01 · Pilot", "/show"],
    [movie, "Film (2024)", "/movie"],
    [album, "Artist – Album", "/album"],
    [track, "Artist – Night Drive", "/album"],
    [photo, "Beach", "/photo"],
    [clip, "Trailer", "/clip"],
    [undefined, "", null],
  ];
  for (const [Metadata, title, poster] of kinds) {
    const p = media("media.play", Metadata);
    expect(templateVars(p).display_title).toBe(title);
    expect(posterPath(p)).toBe(poster);
  }
});

test("music has artist and album variables; other types leave them empty", () => {
  expect(templateVars(media("media.play", track))).toMatchObject({ artist: "Artist", album: "Album" });
  expect(templateVars({ event: "library.new", Metadata: album })).toMatchObject({ artist: "Artist", album: "Album" });
  expect(templateVars(media("media.play", movie))).toMatchObject({ artist: "", album: "" });
});

test("every template renders every event: JSON bodies stay valid, headers stay single-line", () => {
  for (const preset of PRESETS) {
    const headers = Object.fromEntries(
      preset.headers
        .split("\n")
        .filter(Boolean)
        .map((line) => [line.slice(0, line.indexOf(":")).trim(), line.slice(line.indexOf(":") + 1).trim()]),
    );
    for (const p of EVENTS) {
      const body = renderBody(preset.body, p, headers);
      if (!headers["Content-Type"]) expect(() => JSON.parse(body), `${preset.id} / ${p.event}`).not.toThrow();
      for (const v of Object.values(renderHeaders(headers, p))) expect(v).not.toMatch(/[\r\n]/);
    }
  }
});

const received: string[] = [];
const receiver = Bun.serve({
  port: 0,
  fetch: async (req) => {
    received.push(await req.text());
    return new Response("ok");
  },
});
afterAll(() => receiver.stop(true));

test("every event goes out once to an all-events webhook", async () => {
  const db = openDb(":memory:");
  const hook = db.createWebhook({
    name: "all",
    url: receiver.url.href,
    headers: { "Content-Type": "text/plain" },
    bodyTemplate: "{{event}}",
    events: [ALL_EVENTS],
    users: [],
    libraries: [],
    enabled: true,
    attachPoster: false,
  });
  const dispatcher = createDispatcher(db);
  for (const p of EVENTS) await dispatcher.ingest(p);
  await dispatcher.idle();
  expect(received.toSorted()).toEqual(EVENTS.map((p) => p.event).toSorted());
  expect(db.listDeliveries(hook.id).every((d) => d.ok)).toBe(true);
});
