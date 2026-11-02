import { expect, test } from "bun:test";
import type { PlexPayload } from "./types.ts";
import { renderBody, renderHeaders, renderTemplate } from "./template.ts";

const payload: PlexPayload = {
  event: "media.play",
  user: true,
  Account: { id: 7, title: "matt" },
  Metadata: { title: 'Say "Hi"\nagain', year: 2024 },
};

test("missing values render as empty string", () => {
  expect(renderTemplate("[{{Metadata.nope.deeper}}|{{show}}]", payload)).toBe("[|]");
});

test("alias `user` resolves to Account.title, not the top-level boolean", () => {
  expect(renderTemplate("{{ user }}", payload)).toBe("matt");
});

test("dot paths into the raw payload render numbers bare", () => {
  expect(JSON.parse(renderTemplate('{"y": {{Metadata.year}}}', payload))).toEqual({ y: 2024 });
});

test("empty template sends an empty body, not the raw payload", () => {
  expect(renderBody("  \n", payload, {})).toBe("");
});

test("plain-text bodies get values as-is, JSON bodies get them escaped", () => {
  expect(renderBody("Now: {{title}}", payload, { "Content-Type": "text/plain" })).toBe('Now: Say "Hi"\nagain');
  expect(renderBody('{"t": "{{title}}"}', payload, {})).toBe('{"t": "Say \\"Hi\\"\\nagain"}');
});

const episode: PlexPayload = {
  event: "media.scrobble",
  Metadata: { type: "episode", title: "Pilot", grandparentTitle: "Show", parentIndex: 1, index: 2 },
};

test("plex_url opens the item in Plex Web, and is empty without a server id or item key", () => {
  const p: PlexPayload = { event: "library.new", Server: { uuid: "abc123" }, Metadata: { ratingKey: "1000" } };
  expect(renderTemplate("{{plex_url}}", p)).toBe(
    "https://app.plex.tv/desktop/#!/server/abc123/details?key=%2Flibrary%2Fmetadata%2F1000",
  );
  expect(renderTemplate("[{{plex_url}}]", { event: "admin.database.backup", Server: { uuid: "abc123" } })).toBe("[]");
});

test("header values render variables as plain text; empty ones are dropped; line breaks can't split a header", () => {
  const headers = { Title: "{{title}}", Attach: "{{thumb_url}}", Tags: "tv" };
  expect(renderHeaders(headers, payload)).toEqual({ Title: 'Say "Hi" again', Tags: "tv" });
});

test("count and episodes: 1 and empty normally; a group lists its episodes sorted and retitles display_title", () => {
  expect(renderTemplate("{{count}}|{{episodes}}", episode)).toBe("1|");
  const group = [
    { type: "episode", title: "Third", grandparentTitle: "Show", parentIndex: 1, index: 3 },
    { type: "episode", title: "Second", grandparentTitle: "Show", parentIndex: 1, index: 2 },
  ];
  expect(renderTemplate("{{display_title}}|{{count}}", episode, { json: false, group })).toBe("Show · 2 new episodes|2");
  expect(renderTemplate("{{episodes}}", episode, { json: false, group })).toBe("S01E02 · Second\nS01E03 · Third");
});
