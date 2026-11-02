import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import type { Server } from "bun";
import { createApp, type App } from "./app.ts";
import { openDb, type Db } from "./db.ts";
import type { PlexPayload } from "./types.ts";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const plex = { fail: false, requests: [] as { url: string; headers: Headers }[] };
const received: { type: string | null }[] = [];
let pms: Server<undefined>;
let receiver: Server<undefined>;
const apps: App[] = [];
const ingestTokens = new Map<App, string>();

beforeAll(() => {
  pms = Bun.serve({
    port: 0,
    fetch: (req) => {
      const url = new URL(req.url);
      plex.requests.push({ url: req.url, headers: new Headers(req.headers) });
      if (plex.fail) return new Response("nope", { status: 500 });
      if (req.headers.get("x-plex-token") !== "owner-token") return new Response(null, { status: 401 });
      if (url.pathname !== "/photo/:/transcode" || !url.searchParams.get("url")) return new Response(null, { status: 404 });
      return new Response(JPEG, { headers: { "content-type": "image/jpeg" } });
    },
  });
  receiver = Bun.serve({
    port: 0,
    fetch: (req) => {
      received.push({ type: req.headers.get("content-type") });
      return new Response("ok");
    },
  });
});

afterEach(async () => {
  plex.fail = false;
  plex.requests.length = 0;
  received.length = 0;
  for (const app of apps.splice(0)) await app.server.stop(true);
});

afterAll(async () => {
  await pms.stop(true);
  await receiver.stop(true);
});

function start(token: string | null): { app: App; db: Db } {
  const db = openDb(":memory:");
  if (token) db.setSetting("owner_token", token);
  db.createWebhook({
    name: "r",
    url: receiver.url.href,
    headers: {},
    bodyTemplate: '{"t":"{{thumb_url}}"}',
    events: ["*"],
    users: [],
    libraries: [],
    enabled: true,
    attachPoster: true,
  });
  const app = createApp({
    port: 0,
    db,
    index: new Response(""),
    publicUrl: "http://ph.test",
    auth: true,
    plexTvUrl: "http://127.0.0.1:1",
    plexUrl: pms.url.origin,
  });
  apps.push(app);
  ingestTokens.set(app, db.getSetting("ingest_token")!);
  return { app, db };
}

async function ingest(app: App, body: BodyInit, type?: string): Promise<void> {
  const res = await fetch(new URL(`/plex?token=${ingestTokens.get(app)}`, app.server.url), {
    method: "POST",
    body,
    headers: type ? { "content-type": type } : undefined,
  });
  expect(res.status).toBe(200);
  await app.dispatcher.idle();
}

const pause: PlexPayload = { event: "media.pause", Metadata: { type: "movie", title: "Film", thumb: "/library/metadata/5/thumb/1" } };

test("an event gets its poster from the Plex server, without the token in the URL", async () => {
  const { app, db } = start("owner-token");
  await ingest(app, JSON.stringify(pause), "application/json");

  expect(new URL(plex.requests[0]!.url).search).not.toContain("owner-token");
  const [event] = db.listEvents();
  const thumb = await fetch(new URL(`/thumbs/${event!.thumbKey}`, app.server.url));
  expect(new Uint8Array(await thumb.arrayBuffer())).toEqual(JPEG);
  expect(received).toHaveLength(1);
  expect(received[0]!.type).toStartWith("multipart/form-data");
});

test("no owner token or a Plex error: no poster, the delivery still goes out", async () => {
  const noToken = start(null);
  await ingest(noToken.app, JSON.stringify(pause), "application/json");
  expect(plex.requests).toHaveLength(0);
  expect(noToken.db.listEvents()[0]!.thumbKey).toBeNull();
  expect(received).toHaveLength(1);

  plex.fail = true;
  const failing = start("owner-token");
  await ingest(failing.app, JSON.stringify(pause), "application/json");
  expect(plex.requests).toHaveLength(1);
  expect(failing.db.listEvents()[0]!.thumbKey).toBeNull();
  expect(received).toHaveLength(2);
  expect(received[1]!.type).toBe("application/json");
});

test("the server's poster replaces Plex's attached thumb, which is kept when the fetch fails", async () => {
  const attached = new Uint8Array([0xff, 0xd8, 9]);
  const playWithThumb = () => {
    const form = new FormData();
    form.set("payload", JSON.stringify({ ...pause, event: "media.play" }));
    form.set("thumb", new Blob([attached], { type: "image/jpeg" }), "thumb.jpg");
    return form;
  };

  const { app, db } = start("owner-token");
  await ingest(app, playWithThumb());
  expect(plex.requests).toHaveLength(1);
  expect(db.getThumb(db.listEvents()[0]!.thumbKey!)?.bytes).toEqual(JPEG);

  plex.fail = true;
  const failing = start("owner-token");
  await ingest(failing.app, playWithThumb());
  expect(failing.db.getThumb(failing.db.listEvents()[0]!.thumbKey!)?.bytes).toEqual(attached);

  const noToken = start(null);
  await ingest(noToken.app, playWithThumb());
  expect(noToken.db.getThumb(noToken.db.listEvents()[0]!.thumbKey!)?.bytes).toEqual(attached);
  expect(received).toHaveLength(3);
});
