import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import type { Server } from "bun";
import { createApp, type App } from "./app.ts";
import { openDb, type Db } from "./db.ts";
import { MASK, maskBody, maskHeaders, maskUrl } from "./secrets.ts";

test("maskUrl hides token-like segments, webhook keys, ntfy topics, secret query values and passwords; plain URLs come back untouched", () => {
  expect(maskUrl("https://discord.com/api/webhooks/1234567890123456789/AbC-dEf_gHi123JkL456mNo789pQr")).toBe(
    `https://discord.com/api/webhooks/1234567890123456789/${MASK}`,
  );
  expect(maskUrl("https://hooks.slack.com/services/T0123ABCD/B0456EFGH/fakeToken1234567890x")).toBe(
    `https://hooks.slack.com/services/T0123ABCD/B0456EFGH/${MASK}`,
  );
  expect(maskUrl("http://gotify.lan/message?token=AbCd1234&priority=5")).toBe(`http://gotify.lan/message?token=${MASK}&priority=5`);
  expect(maskUrl("https://user:hunter2@n8n.lan/webhook/plex")).toBe(`https://user:${MASK}@n8n.lan/webhook/${MASK}`);
  expect(maskUrl("http://homeassistant.local:8123/api/webhook/plex-play")).toBe(`http://homeassistant.local:8123/api/webhook/${MASK}`);
  expect(maskUrl("https://ntfy.sh/My-Topic")).toBe(`https://ntfy.sh/${MASK}`);
  expect(maskUrl("http://ntfy.lan:8090/plex?title=x")).toBe(`http://ntfy.lan:8090/${MASK}?title=x`);
  expect(maskUrl("http://example.com/hook")).toBe("http://example.com/hook");
});

test("secret names are whole words, so author and monkey aren't secrets but apiKey and access_token are", () => {
  expect(maskHeaders({ "X-Api-Key": "k", Author: "a", "X-Plex-Token": "t", Monkey: "m" })).toEqual({
    "X-Api-Key": MASK,
    Author: "a",
    "X-Plex-Token": MASK,
    Monkey: "m",
  });
});

test("maskBody hides secret-named and token-like JSON and form values, in order, but never templates", () => {
  const body = '{"token":"abc","user":"uQiRzpo4DXghDmr9QzzfQu27cmVRsG","apiKey":"{{title}}","author":"Plex","url":"https://plex.tv/123456789abcdefgh"}';
  expect(maskBody(body)).toEqual({
    text: `{"token":"${MASK}","user":"${MASK}","apiKey":"{{title}}","author":"Plex","url":"https://plex.tv/123456789abcdefgh"}`,
    secrets: ["abc", "uQiRzpo4DXghDmr9QzzfQu27cmVRsG"],
  });
  expect(maskBody("token=abc123&message={{title}}")).toEqual({ text: `token=${MASK}&message={{title}}`, secrets: ["abc123"] });
});

const SECRET_PATH = "/hook/AbC-dEf_gHi123JkL456mNo789pQr";
const received: { path: string; auth: string | null; title: string | null }[] = [];
let receiver: Server<undefined>;
const apps: App[] = [];

beforeAll(() => {
  receiver = Bun.serve({
    port: 0,
    fetch: (req) => {
      received.push({ path: new URL(req.url).pathname, auth: req.headers.get("authorization"), title: req.headers.get("title") });
      return new Response("ok");
    },
  });
});

afterEach(async () => {
  received.length = 0;
  for (const app of apps.splice(0)) await app.server.stop(true);
});

afterAll(async () => {
  await receiver.stop(true);
});

function start(): { db: Db; api: (path: string, method: string, body?: unknown) => Promise<Response> } {
  const db = openDb(":memory:");
  const app = createApp({ port: 0, db, index: new Response(""), auth: false, plexTvUrl: "http://127.0.0.1:1", plexUrl: "http://127.0.0.1:1" });
  apps.push(app);
  const api = (path: string, method: string, body?: unknown) =>
    fetch(new URL(path, app.server.url), {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  return { db, api };
}

const webhook = () => ({
  name: "hook",
  url: new URL(SECRET_PATH, receiver.url).href,
  headers: { Authorization: "Bearer tk_live_123", Title: "{{title}}" },
  bodyTemplate: "",
  events: ["*"],
});

test("the API never returns saved secrets, and masked values sent back keep the saved ones", async () => {
  const { db, api } = start();
  const realUrl = webhook().url;
  const created = (await (await api("/api/webhooks", "POST", webhook())).json()) as { id: number; url: string; headers: Record<string, string> };
  const maskedUrl = `${receiver.url.origin}/hook/${MASK}`;
  expect(created.url).toBe(maskedUrl);
  expect(created.headers).toEqual({ Authorization: MASK, Title: "{{title}}" });
  const [listed] = (await (await api("/api/webhooks", "GET")).json()) as (typeof created & Record<string, unknown>)[];
  expect(listed!.url).toBe(maskedUrl);
  expect(listed!.headers.Authorization).toBe(MASK);

  const toggled = await api(`/api/webhooks/${created.id}`, "PUT", { ...listed, enabled: false });
  expect(toggled.status).toBe(200);
  expect(db.getWebhook(created.id)).toMatchObject({ url: realUrl, enabled: false, headers: { Authorization: "Bearer tk_live_123" } });

  const copy = (await (await api("/api/webhooks", "POST", { ...listed, name: "copy" })).json()) as { id: number };
  expect(db.getWebhook(copy.id)).toMatchObject({ url: realUrl, headers: { Authorization: "Bearer tk_live_123" } });

  expect((await api("/api/send-test", "POST", listed)).status).toBe(200);
  expect(received).toEqual([{ path: SECRET_PATH, auth: "Bearer tk_live_123", title: "Pilot" }]);
});

test("a hidden value can't be reused somewhere else", async () => {
  const { db, api } = start();
  const created = (await (await api("/api/webhooks", "POST", webhook())).json()) as { id: number; url: string; headers: Record<string, string> };
  const put = (body: object) => api(`/api/webhooks/${created.id}`, "PUT", { ...created, ...body });

  const elsewhere = await put({ url: "http://attacker.example/collect" });
  expect(elsewhere.status).toBe(400);
  expect(await elsewhere.json()).toEqual({ error: "headers include a hidden Authorization value; type it again" });

  const editedAroundMask = await put({ url: created.url.replace("/hook/", "/other/") });
  expect(await editedAroundMask.json()).toEqual({ error: "url has a hidden part; paste the full URL again" });

  expect((await api("/api/webhooks", "POST", { ...created, id: undefined })).status).toBe(400);
  expect((await api("/api/send-test", "POST", { ...created, id: undefined })).status).toBe(400);
  expect(received).toEqual([]);
  expect(db.listWebhooks()).toHaveLength(1);

  const retyped = await put({ url: "http://attacker.example/collect", headers: { Authorization: "Bearer new" } });
  expect(retyped.status).toBe(200);
  expect(db.getWebhook(created.id)!.headers.Authorization).toBe("Bearer new");
});

test("hidden body values survive edits around them, but not a new URL or a changed count", async () => {
  const { db, api } = start();
  const body = { ...webhook(), headers: {}, bodyTemplate: '{"token":"app-secret","msg":"{{title}}","user":"user-secret"}' };
  const created = (await (await api("/api/webhooks", "POST", body)).json()) as { id: number; url: string; bodyTemplate: string };
  expect(created.bodyTemplate).toBe(`{"token":"${MASK}","msg":"{{title}}","user":"user-secret"}`);
  const put = (over: object) => api(`/api/webhooks/${created.id}`, "PUT", { ...created, headers: {}, ...over });

  const edited = await put({ bodyTemplate: created.bodyTemplate.replace("{{title}}", "{{display_title}}") });
  expect(edited.status).toBe(200);
  expect(db.getWebhook(created.id)!.bodyTemplate).toBe('{"token":"app-secret","msg":"{{display_title}}","user":"user-secret"}');

  expect(await (await put({ url: "http://attacker.example/collect" })).json()).toEqual({
    error: "body template has hidden values; type them again",
  });
  expect((await put({ bodyTemplate: `{"a":"${MASK}","b":"${MASK}"}` })).status).toBe(400);
});
