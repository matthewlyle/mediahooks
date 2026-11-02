import { afterAll, expect, test } from "bun:test";
import { openDb } from "./db.ts";
import { createDispatcher, type Clock } from "./dispatch.ts";
import { ALL_EVENTS, type PlexPayload, type Poster, type Webhook, type WebhookInput } from "./types.ts";

const hook = (filters: Partial<Pick<Webhook, "events" | "users" | "libraries">>): Webhook => ({
  id: 1,
  name: "h",
  url: "http://localhost/",
  headers: {},
  bodyTemplate: "",
  events: [ALL_EVENTS],
  users: [],
  libraries: [],
  enabled: true,
  attachPoster: false,
  createdAt: 0,
  ...filters,
});

const play: PlexPayload = {
  event: "media.play",
  Account: { id: 42, title: "Matt" },
  Metadata: { title: "Pilot", librarySectionTitle: "TV Shows", librarySectionID: 2 },
};

type Received = { contentType: string; body: string; fields: Record<string, string>; file?: File; title?: string };
const received: Received[] = [];
const receiver = Bun.serve({
  port: 0,
  async fetch(req) {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const fields: Record<string, string> = {};
      let file: File | undefined;
      for (const [k, v] of form) {
        if (typeof v === "string") fields[k] = v;
        else file = v;
      }
      received.push({ contentType, body: "", fields, file });
    } else {
      received.push({ contentType, body: await req.text(), fields: {}, title: req.headers.get("title") ?? undefined });
    }
    return new Response("ok");
  },
});
afterAll(() => receiver.stop(true));

const poster: Poster = { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]), type: "image/jpeg" };
const target = (attachPoster: boolean): Webhook => ({
  ...hook({}),
  url: new URL("/hook", receiver.url).href,
  bodyTemplate: '{"content": "{{title}}", "image": "{{thumb_url}}"}',
  attachPoster,
});
const lastReceived = (): Received => {
  const r = received.at(-1);
  if (!r) throw new Error("receiver got nothing");
  return r;
};

test("dispatch stores the poster and points thumb_url at the stored event", async () => {
  const db = openDb(":memory:");
  db.createWebhook({ ...target(true), attachPoster: true });

  await createDispatcher(db, { publicUrl: "http://mediahooks.test:8787/" }).ingest(play, poster);
  const [event] = db.listEvents();
  expect(db.getThumb(event!.thumbKey!)?.bytes).toEqual(poster.bytes);
  expect(JSON.parse(lastReceived().fields.payload_json!).image).toBe(`http://mediahooks.test:8787/thumbs/${event!.thumbKey}`);

  await createDispatcher(db).ingest(play, poster);
  expect(JSON.parse(lastReceived().fields.payload_json!).image).toBe("");

  await createDispatcher(db, { publicUrl: "http://mediahooks.test:8787" }).ingest(play);
  expect(JSON.parse(lastReceived().body).image).toBe("");
  expect(db.listEvents()[0]?.thumbKey).toBeNull();
});

function fakeClock(): Clock & { advance(ms: number): void } {
  let now = 0;
  let next = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  return {
    now: () => now,
    setTimeout(fn, ms) {
      timers.set(++next, { at: now + ms, fn });
      return next;
    },
    clearTimeout: (handle) => void timers.delete(handle as number),
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const due = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        now = due[1].at;
        due[1].fn();
      }
      now = end;
    },
  };
}

const MINUTE = 60_000;

const input = (over: Partial<WebhookInput> = {}): WebhookInput => ({
  name: "grouped",
  url: new URL("/hook", receiver.url).href,
  headers: {},
  bodyTemplate:
    '{"t": "{{display_title}}", "n": {{count}}, "e": "{{episodes}}", "s": "{{Metadata.summary}}", "i": "{{thumb_url}}"}',
  events: [ALL_EVENTS],
  users: [],
  libraries: [],
  enabled: true,
  attachPoster: false,
  ...over,
});

const newEpisode = (show: string, season: number, index: number): PlexPayload => ({
  event: "library.new",
  Server: { uuid: "srv" },
  Account: { id: 1, title: "owner" },
  Metadata: {
    type: "episode",
    title: `Episode ${index}`,
    grandparentTitle: show,
    grandparentRatingKey: `${show}-key`,
    parentIndex: season,
    index,
    ratingKey: `${show}-${season}-${index}`,
    librarySectionTitle: "TV Shows",
  },
});

function setup(over: Partial<WebhookInput> = {}) {
  const db = openDb(":memory:");
  const clock = fakeClock();
  const dispatcher = createDispatcher(db, { clock, publicUrl: "http://mediahooks.test:8787" });
  const webhook = db.createWebhook(input(over));
  const start = received.length;
  const bodies = () => received.slice(start).map((r) => JSON.parse(r.body));
  return { db, clock, dispatcher, webhook, bodies };
}

test("a burst of new episodes for one show is held and sent once, merged, after 2 quiet minutes", async () => {
  const { db, clock, dispatcher, bodies } = setup();
  await dispatcher.ingest(newEpisode("Show", 1, 3));
  clock.advance(30_000);
  await dispatcher.ingest(newEpisode("Show", 1, 1), poster);
  clock.advance(30_000);
  await dispatcher.ingest(newEpisode("Show", 1, 2), poster);

  expect(db.listEvents().map((e) => e.routing[0]?.status)).toEqual(["held", "held", "held"]);
  expect(db.listEvents().map((e) => e.routing[0]?.reason)).toEqual(
    Array(3).fill("held to group with other new episodes of Show; sends after 2 minutes without another"),
  );
  clock.advance(2 * MINUTE - 1);
  await dispatcher.idle();
  expect(bodies()).toEqual([]);

  clock.advance(1);
  await dispatcher.idle();
  const list = "S01E01 · Episode 1\nS01E02 · Episode 2\nS01E03 · Episode 3";
  const [first, withPoster, last] = db.listEvents().toReversed();
  expect(bodies()).toEqual([
    {
      t: "Show · 3 new episodes",
      n: 3,
      e: list,
      s: list,
      i: `http://mediahooks.test:8787/thumbs/${withPoster!.thumbKey}`,
    },
  ]);
  expect(first!.routing[0]).toMatchObject({ status: "sent", reason: null });
  expect(last!.routing[0]).toMatchObject({
    status: "grouped",
    reason: `sent in one message for 3 new episodes with event #${first!.id}`,
  });
  expect(dispatcher.pending()).toBe(0);
});

test("a lone new episode goes out as itself after the quiet period; movies and other episode events go immediately", async () => {
  const { db, clock, dispatcher, bodies } = setup();
  await dispatcher.ingest({ event: "library.new", Metadata: { type: "movie", title: "Film", year: 2023 } });
  await dispatcher.ingest({ ...newEpisode("Show", 2, 5), event: "media.play" });
  await dispatcher.ingest(newEpisode("Show", 2, 5));
  expect(bodies().map((b) => b.t)).toEqual(["Film (2023)", "Show S02E05 · Episode 5"]);

  clock.advance(2 * MINUTE);
  await dispatcher.idle();
  expect(bodies()[2]).toEqual({ t: "Show S02E05 · Episode 5", n: 1, e: "", s: "", i: "" });
  expect(db.listEvents()[0]?.routing[0]?.reason).toBeNull();
});

test("different shows group separately", async () => {
  const { clock, dispatcher, bodies } = setup();
  await dispatcher.ingest(newEpisode("Alpha", 1, 1));
  await dispatcher.ingest(newEpisode("Beta", 1, 1));
  await dispatcher.ingest(newEpisode("Alpha", 1, 2));
  await dispatcher.ingest(newEpisode("Beta", 1, 2));
  expect(dispatcher.pending()).toBe(2);
  clock.advance(2 * MINUTE);
  await dispatcher.idle();
  expect(bodies().map((b) => b.t).sort()).toEqual(["Alpha · 2 new episodes", "Beta · 2 new episodes"]);
});

test("a show that keeps getting episodes is flushed 10 minutes after its first one", async () => {
  const { clock, dispatcher, bodies } = setup();
  for (let i = 1; i <= 10; i++) {
    await dispatcher.ingest(newEpisode("Show", 1, i));
    clock.advance(100_000);
    await dispatcher.idle();
    expect(bodies().length).toBe(i < 6 ? 0 : 1);
  }
  expect(bodies()[0].n).toBe(6);
  clock.advance(2 * MINUTE);
  await dispatcher.idle();
  expect(bodies().map((b) => b.n)).toEqual([6, 4]);
});

test("each delivery keeps what was sent and what came back, with secrets masked and long bodies cut", async () => {
  const echo = Bun.serve({
    port: 0,
    fetch: (req) =>
      new URL(req.url).pathname.endsWith("/long")
        ? new Response("x".repeat(9000), { status: 400 })
        : Response.json({ id: "msg-1" }, { headers: { "x-ratelimit-remaining": "4", "set-cookie": "s=1" } }),
  });
  try {
    const db = openDb(":memory:");
    const base = { ...input({}), headers: { Authorization: "Bearer tk_live_123", Title: "{{title}}" }, bodyTemplate: '{"t":"{{title}}"}' };
    const json = db.createWebhook({ ...base, url: new URL("/api/webhooks/1/AbC-dEf_gHi123JkL456mNo789pQr", echo.url).href });
    const poster = db.createWebhook({ ...base, url: new URL("/poster", echo.url).href, attachPoster: true });
    await createDispatcher(db).ingest(play, { bytes: new Uint8Array([0xff, 0xd8, 0xff]), type: "image/jpeg" });

    const sent = db.getDelivery(db.listDeliveries(json.id)[0]!.id)!;
    expect(sent.request).toMatchObject({
      url: `${echo.url.origin}/api/webhooks/1/••••••`,
      headers: { authorization: "••••••", title: "Pilot", "content-type": "application/json" },
      body: '{"t":"Pilot"}',
      truncated: false,
    });
    expect(sent.response).toMatchObject({ body: '{"id":"msg-1"}', truncated: false });
    expect(sent.response!.headers).toMatchObject({ "x-ratelimit-remaining": "4", "set-cookie": "••••••" });

    const multipart = db.getDelivery(db.listDeliveries(poster.id)[0]!.id)!;
    expect(multipart.request!.headers["content-type"]).toBe("multipart/form-data");
    expect(multipart.request!.body).toBe('payload_json:\n{"t":"Pilot"}\n\nfiles[0]: poster.jpg (image/jpeg, 3 bytes)');

    const long = db.createWebhook({ ...base, url: new URL("/long", echo.url).href, events: ["media.stop"] });
    await createDispatcher(db).ingest({ ...play, event: "media.stop" });
    const cut = db.getDelivery(db.listDeliveries(long.id)[0]!.id)!;
    expect(cut.status).toBe(400);
    expect(cut.response!.body).toHaveLength(8192);
    expect(cut.response!.truncated).toBe(true);
  } finally {
    await echo.stop(true);
  }
});
