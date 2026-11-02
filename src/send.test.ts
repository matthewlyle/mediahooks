import { afterAll, expect, test } from "bun:test";
import { send } from "./send.ts";
import type { PlexPayload, Poster } from "./types.ts";

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

const play: PlexPayload = { event: "media.play", Metadata: { title: "Pilot" } };
const poster: Poster = { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]), type: "image/jpeg" };
const target = (attachPoster: boolean) => ({
  url: new URL("/hook", receiver.url).href,
  headers: {},
  bodyTemplate: '{"content": "{{title}}", "image": "{{thumb_url}}"}',
  attachPoster,
});
const lastReceived = (): Received => {
  const r = received.at(-1);
  if (!r) throw new Error("receiver got nothing");
  return r;
};

test("attachPoster with a poster sends multipart: payload_json + files[0] named poster.jpg", async () => {
  const res = await send(target(true), play, { poster, thumbUrl: "http://x/thumbs/1" });
  expect(res.ok).toBe(true);
  const r = lastReceived();
  expect(r.contentType).toStartWith("multipart/form-data; boundary=");
  expect(JSON.parse(r.fields.payload_json!)).toEqual({ content: "Pilot", image: "http://x/thumbs/1" });
  expect(r.file?.name).toBe("poster.jpg");
  expect(r.file?.type).toBe("image/jpeg");
  expect(new Uint8Array(await r.file!.arrayBuffer())).toEqual(poster.bytes);
});

test("without a poster, or with attachPoster off, the body is plain JSON", async () => {
  await send(target(true), play);
  expect(lastReceived().contentType).toBe("application/json");
  expect(JSON.parse(lastReceived().body)).toEqual({ content: "Pilot", image: "" });

  await send(target(false), play, { poster, thumbUrl: "http://x/thumbs/1" });
  expect(lastReceived().contentType).toBe("application/json");
  expect(JSON.parse(lastReceived().body)).toEqual({ content: "Pilot", image: "http://x/thumbs/1" });
});

test("non-ASCII header values arrive RFC 2047-encoded instead of failing the send", async () => {
  const amelie = { event: "media.play", Metadata: { title: "Amélie" } };
  const res = await send({ ...target(false), headers: { Title: "{{title}}" } }, amelie);
  expect(res.ok).toBe(true);
  const raw = lastReceived().title ?? "";
  expect(raw).toStartWith("=?UTF-8?B?");
  expect(Buffer.from(raw.slice("=?UTF-8?B?".length, -2), "base64").toString("utf8")).toBe("Amélie");
});
