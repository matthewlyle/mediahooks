import { afterAll, beforeAll, expect, test } from "bun:test";
import type { Server } from "bun";
import { openDb } from "./db.ts";
import { createDispatcher, type Clock } from "./dispatch.ts";
import { ALL_EVENTS, type PlexPayload, type WebhookInput } from "./types.ts";

const scripts = new Map<string, number[]>();
const hits = new Map<string, number>();
let receiver: Server<undefined>;

beforeAll(() => {
  receiver = Bun.serve({
    port: 0,
    fetch: (req) => {
      const path = new URL(req.url).pathname;
      hits.set(path, (hits.get(path) ?? 0) + 1);
      return new Response("body", { status: scripts.get(path)?.shift() ?? 200 });
    },
  });
});

afterAll(async () => {
  await receiver.stop(true);
});

let nextPath = 0;
function hook(statuses: number[], over: Partial<WebhookInput> = {}): WebhookInput {
  const path = `/hook-${++nextPath}`;
  scripts.set(path, statuses);
  return {
    name: path.slice(1),
    url: new URL(path, receiver.url).href,
    headers: {},
    bodyTemplate: '{"t":"{{title}}"}',
    events: [ALL_EVENTS],
    users: [],
    libraries: [],
    enabled: true,
    attachPoster: false,
    ...over,
  };
}

const hitsOf = (url: string) => hits.get(new URL(url).pathname) ?? 0;

function instantClock(): Clock & { delays: number[] } {
  const delays: number[] = [];
  return {
    delays,
    now: () => 0,
    setTimeout(fn, ms) {
      delays.push(ms);
      queueMicrotask(fn);
      return null;
    },
    clearTimeout: () => {},
  };
}

function manualClock(): Clock & { pending: { fn: () => void; ms: number }[]; fire(): void } {
  const pending: { fn: () => void; ms: number }[] = [];
  return {
    pending,
    now: () => 0,
    setTimeout(fn, ms) {
      const timer = { fn, ms };
      pending.push(timer);
      return timer;
    },
    clearTimeout(handle) {
      const i = pending.indexOf(handle as (typeof pending)[number]);
      if (i !== -1) pending.splice(i, 1);
    },
    fire() {
      for (const t of pending.splice(0)) t.fn();
    },
  };
}

async function until(check: () => boolean): Promise<void> {
  for (let i = 0; i < 400 && !check(); i++) await Bun.sleep(5);
  expect(check()).toBe(true);
}

const play: PlexPayload = { event: "media.play", Metadata: { title: "Pilot" } };

test("a 5xx is retried after 5s and one delivery row records the final outcome", async () => {
  const db = openDb(":memory:");
  const w = db.createWebhook(hook([502, 200]));
  const clock = instantClock();
  const dispatcher = createDispatcher(db, { clock });
  await dispatcher.ingest(play);
  await dispatcher.idle();
  expect(clock.delays).toEqual([5_000]);
  expect(hitsOf(w.url)).toBe(2);
  const rows = db.listDeliveries(w.id);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ attempts: 2, ok: true, status: 200, error: null });
  expect(db.latestDeliveries().get(w.id)?.attempts).toBe(2);
});

test("network errors are retried 3 times (5s, 20s, 60s) and then given up", async () => {
  const db = openDb(":memory:");
  const w = db.createWebhook({ ...hook([]), url: "http://127.0.0.1:1/hook" });
  const clock = instantClock();
  const dispatcher = createDispatcher(db, { clock });
  await dispatcher.ingest(play);
  await dispatcher.idle();
  expect(clock.delays).toEqual([5_000, 20_000, 60_000]);
  const rows = db.listDeliveries(w.id);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ attempts: 4, ok: false, status: null });
  expect(rows[0]!.error).not.toBeNull();
});

test("a 4xx is not retried, but a 429 is", async () => {
  const db = openDb(":memory:");
  const bad = db.createWebhook(hook([400]));
  const limited = db.createWebhook(hook([429, 200]));
  const clock = instantClock();
  const dispatcher = createDispatcher(db, { clock });
  await dispatcher.ingest(play);
  await dispatcher.idle();
  expect(hitsOf(bad.url)).toBe(1);
  expect(db.listDeliveries(bad.id)[0]).toMatchObject({ attempts: 1, ok: false, status: 400, error: "body" });
  expect(hitsOf(limited.url)).toBe(2);
  expect(db.listDeliveries(limited.id)[0]).toMatchObject({ attempts: 2, ok: true, status: 200 });
});

test("other webhooks and new events go out while one webhook waits to retry", async () => {
  const db = openDb(":memory:");
  const failing = db.createWebhook(hook([500, 500]));
  const healthy = db.createWebhook(hook([]));
  const clock = manualClock();
  const dispatcher = createDispatcher(db, { clock });

  void dispatcher.ingest(play);
  await until(() => clock.pending.length === 1 && db.listDeliveries(healthy.id).length === 1);
  void dispatcher.ingest({ ...play, event: "media.stop" });
  await until(() => clock.pending.length === 2 && db.listDeliveries(healthy.id).length === 2);
  expect(db.listDeliveries(failing.id)).toHaveLength(0);

  clock.fire();
  await dispatcher.idle();
  const rows = db.listDeliveries(failing.id);
  expect(rows.map((r) => [r.event, r.attempts, r.ok])).toContainAllValues([
    ["media.play", 2, true],
    ["media.stop", 2, true],
  ]);
});

test("shutdown drops pending retries and records the failure so far", async () => {
  const db = openDb(":memory:");
  const w = db.createWebhook(hook([503]));
  const clock = manualClock();
  const dispatcher = createDispatcher(db, { clock });
  void dispatcher.ingest(play);
  await until(() => clock.pending.length === 1);
  await dispatcher.flushAll();
  expect(clock.pending).toHaveLength(0);
  expect(hitsOf(w.url)).toBe(1);
  expect(db.listDeliveries(w.id)[0]).toMatchObject({ attempts: 1, ok: false, status: 503 });
});
