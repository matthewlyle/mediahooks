import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import type { Server } from "bun";
import { createApp, type App, type AppConfig } from "./app.ts";
import { openDb } from "./db.ts";

const MACHINE = "machine-1";
const ACCOUNTS: Record<string, { id: number; username: string; title: string; thumb: string; owns: boolean }> = {
  "owner-token": { id: 1, username: "matt", title: "matt", thumb: "https://plex.tv/users/1/avatar", owns: true },
  "friend-token": { id: 2, username: "friend", title: "friend", thumb: "", owns: false },
};
const SHARED_USERS = `<?xml version="1.0" encoding="UTF-8"?>
<MediaContainer friendlyName="myPlex" identifier="com.plexapp.plugins.myplex" size="3">
  <User id="2" title="friend" username="friend" thumb="https://plex.tv/users/2/avatar" home="0">
    <Server id="9" serverId="9" machineIdentifier="${MACHINE}" name="mini" lastSeenAt="1" numLibraries="2" owned="1" />
  </User>
  <User id="3" title="Tom &amp; Jerry" username="tj" thumb="" home="0">
    <Server id="10" serverId="10" machineIdentifier="someone-elses-server" name="other" owned="1" />
  </User>
  <User id="4" title="Kid" username="" thumb="https://plex.tv/users/4/avatar" home="1" restricted="1"/>
</MediaContainer>`;

const plexTv = { pinToken: null as string | null, headers: [] as Headers[] };
let tv: Server<undefined>;
let pms: Server<undefined>;
const apps: App[] = [];

beforeAll(() => {
  tv = Bun.serve({
    port: 0,
    routes: {
      "/api/v2/pins": {
        POST: (req) => {
          plexTv.headers.push(req.headers);
          return Response.json({ id: 7, code: "pin-code" });
        },
      },
      "/api/v2/pins/:id": {
        GET: (req) =>
          req.params.id === "7" ? Response.json({ id: 7, code: "pin-code", authToken: plexTv.pinToken }) : new Response(null, { status: 404 }),
      },
      "/api/v2/user": {
        GET: (req) => {
          const a = ACCOUNTS[req.headers.get("x-plex-token") ?? ""];
          return a ? Response.json(a) : new Response(null, { status: 401 });
        },
      },
      "/api/v2/resources": {
        GET: (req) =>
          Response.json([
            { name: "mini", provides: "server", clientIdentifier: MACHINE, owned: ACCOUNTS[req.headers.get("x-plex-token") ?? ""]?.owns === true },
          ]),
      },
      "/api/v2/home/users": {
        GET: () => Response.json({ users: [{ id: 1, title: "matt", thumb: "" }, { id: 4, title: "Kid", thumb: "https://plex.tv/users/4/avatar" }] }),
      },
      "/api/users": { GET: () => new Response(SHARED_USERS, { headers: { "content-type": "application/xml" } }) },
    },
  });
  pms = Bun.serve({
    port: 0,
    routes: {
      "/identity": { GET: () => Response.json({ MediaContainer: { machineIdentifier: MACHINE } }) },
      "/library/sections": {
        GET: (req) =>
          req.headers.get("x-plex-token") === "owner-token"
            ? Response.json({
                MediaContainer: {
                  Directory: [
                    { key: "1", title: "Movies", type: "movie" },
                    { key: "2", title: "TV Shows", type: "show" },
                  ],
                },
              })
            : new Response(null, { status: 401 }),
      },
    },
  });
});

afterEach(async () => {
  plexTv.pinToken = null;
  for (const app of apps.splice(0)) await app.server.stop(true);
});

afterAll(async () => {
  await tv.stop(true);
  await pms.stop(true);
});

function start(overrides: Partial<AppConfig> = {}): App {
  const app = createApp({
    port: 0,
    db: openDb(":memory:"),
    index: new Response("<!doctype html>", { headers: { "content-type": "text/html" } }),
    auth: true,
    plexTvUrl: tv.url.origin,
    plexUrl: pms.url.origin,
    ...overrides,
  });
  apps.push(app);
  return app;
}

const call = (app: App, path: string, init?: RequestInit) => fetch(new URL(path, app.server.url), init);

async function signIn(app: App, plexToken: string): Promise<{ res: Response; cookie: string | null }> {
  plexTv.pinToken = plexToken;
  const res = await call(app, "/api/auth/pin/7", { method: "POST" });
  const cookie = res.headers.get("set-cookie")?.match(/mediahooks_session=([^;]+)/)?.[0] ?? null;
  return { res, cookie };
}

test("the owner signs in through a Plex PIN and gets a session cookie", async () => {
  const app = start();
  const pin = await call(app, "/api/auth/pin", { method: "POST" });
  const body = (await pin.json()) as { id: number; code: string; authUrl: string };
  expect(body.id).toBe(7);
  expect(body.authUrl).toStartWith("https://app.plex.tv/auth#?clientID=");
  expect(body.authUrl).toContain("&code=pin-code&context%5Bdevice%5D%5Bproduct%5D=mediahooks");

  expect(await (await call(app, "/api/auth/pin/7", { method: "POST" })).json()).toEqual({ status: "waiting" });

  const { res, cookie } = await signIn(app, "owner-token");
  expect(await res.json()).toEqual({ status: "signed-in", user: { username: "matt", thumb: "https://plex.tv/users/1/avatar" } });
  const setCookie = res.headers.get("set-cookie")!;
  expect(setCookie).toContain("HttpOnly");
  expect(setCookie).toContain("SameSite=Lax");
  expect(setCookie).toContain("Path=/");
  expect(setCookie).not.toContain("Secure");

  const me = await call(app, "/api/auth/me", { headers: { cookie: cookie! } });
  expect(me.status).toBe(200);
  expect(await me.json()).toEqual({ user: { username: "matt", thumb: "https://plex.tv/users/1/avatar" } });
});

test("plex.tv calls identify mediahooks with a stable client id", async () => {
  const db = openDb(":memory:");
  const clientIdOf = async (app: App) => {
    const { authUrl } = (await (await call(app, "/api/auth/pin", { method: "POST" })).json()) as { authUrl: string };
    return new URLSearchParams(authUrl.split("#?")[1]).get("clientID");
  };
  plexTv.headers.length = 0;
  const cid = await clientIdOf(start({ db }));
  expect(cid).toMatch(/^[0-9a-f-]{36}$/);
  expect(await clientIdOf(start({ db }))).toBe(cid);
  expect(plexTv.headers[0]?.get("x-plex-client-identifier")).toBe(cid);
});

test("an account that doesn't own PLEX_URL's server gets 403", async () => {
  const app = start();
  const { res, cookie } = await signIn(app, "friend-token");
  expect(res.status).toBe(403);
  expect(await res.json()).toEqual({ error: "This Plex account doesn't own this server." });
  expect(cookie).toBeNull();
});

test("/api routes need a session; pages, /healthz and /thumbs/<key> don't; /plex needs the ingest token", async () => {
  const db = openDb(":memory:");
  const app = start({ db });
  expect((await call(app, "/api/webhooks")).status).toBe(401);
  expect((await call(app, "/api/meta")).status).toBe(401);
  expect((await call(app, "/api/auth/me")).status).toBe(401);
  const { cookie } = await signIn(app, "owner-token");
  expect((await call(app, "/api/webhooks", { headers: { cookie: cookie! } })).status).toBe(200);

  const { ingestToken } = (await (await call(app, "/api/meta", { headers: { cookie: cookie! } })).json()) as { ingestToken: string };
  expect((await (await call(start({ db }), "/api/meta", { headers: { cookie: cookie! } })).json()).ingestToken).toBe(ingestToken);

  const post = (query: string) => {
    const form = new FormData();
    form.set("payload", JSON.stringify({ event: "media.play", Metadata: { title: "Pilot" } }));
    form.set("thumb", new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" }), "thumb.jpg");
    return call(app, `/plex${query}`, { method: "POST", body: form });
  };
  expect((await post("")).status).toBe(401);
  expect((await post("?token=wrong")).status).toBe(401);
  expect((await post(`?token=${ingestToken}`)).status).toBe(200);
  await app.dispatcher.idle();
  expect(db.listEvents()).toHaveLength(1);

  expect((await call(app, "/api/thumbs/latest")).status).toBe(401);
  expect((await call(app, "/api/thumbs/latest", { headers: { cookie: cookie! } })).headers.get("content-type")).toBe("image/jpeg");
  const { id, thumbKey } = db.listEvents()[0]!;
  expect((await call(app, `/thumbs/${thumbKey}`)).status).toBe(200);
  expect((await call(app, `/thumbs/${id}`)).status).toBe(404);
  expect((await call(app, "/events")).status).toBe(200);
  expect(await (await call(app, "/healthz")).text()).toBe("ok");
});

test("replacing the ingest token needs a session, and only the new token works afterwards", async () => {
  const db = openDb(":memory:");
  const app = start({ db });
  const old = db.getSetting("ingest_token")!;
  const ingest = (token: string) =>
    call(app, `/plex?token=${token}`, { method: "POST", headers: { "content-type": "application/json" }, body: '{"event":"media.play"}' });

  expect((await call(app, "/api/ingest-token", { method: "POST" })).status).toBe(401);
  const { cookie } = await signIn(app, "owner-token");
  const res = await call(app, "/api/ingest-token", { method: "POST", headers: { cookie: cookie! } });
  const { ingestToken } = (await res.json()) as { ingestToken: string };

  expect((await ingest(old)).status).toBe(401);
  expect((await ingest(ingestToken)).status).toBe(200);
  const meta = (await (await call(app, "/api/meta", { headers: { cookie: cookie! } })).json()) as { ingestToken: string };
  expect(meta.ingestToken).toBe(ingestToken);
  await app.dispatcher.idle();
});

test("mutating /api requests from another origin get 403", async () => {
  const app = start();
  const { cookie } = await signIn(app, "owner-token");
  const post = (headers: Record<string, string>) =>
    call(app, "/api/webhooks", {
      method: "POST",
      headers: { cookie: cookie!, "content-type": "application/json", ...headers },
      body: JSON.stringify({ name: "x", url: "http://localhost:1/", events: ["*"] }),
    });
  expect((await post({ origin: "http://evil.example" })).status).toBe(403);
  expect((await post({ origin: app.server.url.origin })).status).toBe(201);
  expect((await call(app, "/api/auth/signout", { method: "POST", headers: { cookie: cookie!, origin: "null" } })).status).toBe(403);

  expect((await post({ origin: "https://hooks.example", "sec-fetch-site": "same-origin" })).status).toBe(201);
  expect((await post({ origin: app.server.url.origin, "sec-fetch-site": "cross-site" })).status).toBe(403);
  expect((await post({ origin: app.server.url.origin, "sec-fetch-site": "same-site" })).status).toBe(403);
});

test("signing in through an https proxy sets a Secure cookie", async () => {
  const app = start();
  plexTv.pinToken = "owner-token";
  const fromBrowser = { origin: "https://hooks.example", "sec-fetch-site": "same-origin" };
  const viaOrigin = await call(app, "/api/auth/pin/7", { method: "POST", headers: fromBrowser });
  expect(viaOrigin.headers.get("set-cookie")).toContain("Secure");
  const viaHeader = await call(app, "/api/auth/pin/7", { method: "POST", headers: { "x-forwarded-proto": "https" } });
  expect(viaHeader.headers.get("set-cookie")).toContain("Secure");
});

test("signing out deletes the session and clears the cookie", async () => {
  const app = start();
  const { cookie } = await signIn(app, "owner-token");
  const out = await call(app, "/api/auth/signout", { method: "POST", headers: { cookie: cookie! } });
  expect(out.status).toBe(204);
  expect(out.headers.get("set-cookie")).toMatch(/mediahooks_session=;.*(Max-Age=0|Expires=Thu, 01 Jan 1970)/);
  expect((await call(app, "/api/auth/me", { headers: { cookie: cookie! } })).status).toBe(401);
  expect((await call(app, "/api/webhooks", { headers: { cookie: cookie! } })).status).toBe(401);
});

test("/api/plex lists the server's libraries and the users who can reach it", async () => {
  const app = start();
  const { cookie } = await signIn(app, "owner-token");
  const libraries = await call(app, "/api/plex/libraries", { headers: { cookie: cookie! } });
  expect(await libraries.json()).toEqual([
    { id: 1, title: "Movies", type: "movie" },
    { id: 2, title: "TV Shows", type: "show" },
  ]);
  const users = await call(app, "/api/plex/users", { headers: { cookie: cookie! } });
  expect(await users.json()).toEqual([
    { id: 1, title: "matt", thumb: "https://plex.tv/users/1/avatar" },
    { id: 2, title: "friend", thumb: "https://plex.tv/users/2/avatar" },
    { id: 4, title: "Kid", thumb: "https://plex.tv/users/4/avatar" },
  ]);
});

test("AUTH=off leaves the API open", async () => {
  const app = start({ auth: false });
  expect((await call(app, "/api/webhooks")).status).toBe(200);
  expect(await (await call(app, "/api/auth/me")).json()).toEqual({ user: null });
  expect((await call(app, "/api/auth/pin", { method: "POST" })).status).toBe(404);
});

test("/api/status reports when the newest event arrived", async () => {
  const db = openDb(":memory:");
  const app = start({ db });
  const { cookie } = await signIn(app, "owner-token");
  const status = async () => (await call(app, "/api/status", { headers: { cookie: cookie! } })).json();
  expect((await call(app, "/api/status")).status).toBe(401);
  expect(await status()).toEqual({ lastEventAt: null });
  const before = Date.now();
  const ingest = (event: string) =>
    call(app, `/plex?token=${db.getSetting("ingest_token")}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event }),
    });
  await ingest("media.play");
  await ingest("media.stop");
  await app.dispatcher.idle();
  const { lastEventAt } = (await status()) as { lastEventAt: number };
  expect(lastEventAt).toBeGreaterThanOrEqual(before);
  expect(lastEventAt).toBe(Math.max(...db.listEvents().map((e) => e.receivedAt)));
});
