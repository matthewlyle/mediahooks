import { afterAll, expect, test } from "bun:test";
import { createApp } from "./app.ts";
import { openDb } from "./db.ts";
import type { PlexPayload } from "./types.ts";

const bodies: string[] = [];
const receiver = Bun.serve({
  port: 0,
  fetch: async (req) => {
    bodies.push(await req.text());
    return new Response("ok");
  },
});
const db = openDb(":memory:");
const app = createApp({ port: 0, db, index: new Response(""), auth: false, plexTvUrl: "http://127.0.0.1:1", plexUrl: "http://127.0.0.1:1" });
afterAll(async () => {
  await app.server.stop(true);
  await receiver.stop(true);
});

const event = (e: string, title: string): PlexPayload => ({ event: e, Metadata: { type: "movie", title } });
const older = db.recordEvent(event("media.play", "Older Play"), [], null).id;
db.recordEvent(event("library.new", "Newest Added"), [], null);

async function sendTest(extra: object): Promise<string> {
  const res = await fetch(new URL("/api/send-test", app.server.url), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "t", url: receiver.url.href, bodyTemplate: "{{event}} {{title}}", headers: { "Content-Type": "text/plain" }, events: ["media.play"], ...extra }),
  });
  expect(res.status).toBe(200);
  return bodies.at(-1)!;
}

test("a test sends the event the preview shows, the sample when it shows the sample, else the newest match", async () => {
  expect(await sendTest({ eventId: older })).toBe("media.play Older Play");
  expect(await sendTest({ eventId: null })).toBe("media.play Pilot");
  expect(await sendTest({})).toBe("media.play Older Play");
  expect(await sendTest({ events: ["media.stop"] })).toBe("media.play Pilot");
  expect(await sendTest({ eventId: 9999 })).toBe("media.play Pilot");
});
