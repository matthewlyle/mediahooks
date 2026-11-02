import { expect, test } from "bun:test";
import { ALL_EVENTS } from "./types.ts";
import { validateWebhook } from "./validate.ts";

const base = { name: "h", url: "http://localhost/hook" };

test("events are required: none selected is rejected", () => {
  expect(validateWebhook({ ...base })).toEqual({ ok: false, error: "choose at least one event" });
  expect(validateWebhook({ ...base, events: [] })).toEqual({ ok: false, error: "choose at least one event" });
});

test("all events is an explicit choice and can't be mixed with specific events", () => {
  const all = validateWebhook({ ...base, events: [ALL_EVENTS] });
  expect(all.ok && all.value.events).toEqual([ALL_EVENTS]);
  expect(validateWebhook({ ...base, events: [ALL_EVENTS, "media.play"] }).ok).toBe(false);
});

test("specific events must be known Plex events", () => {
  expect(validateWebhook({ ...base, events: ["media.play"] }).ok).toBe(true);
  expect(validateWebhook({ ...base, events: ["media.nope"] })).toEqual({ ok: false, error: "unknown event: media.nope" });
});
