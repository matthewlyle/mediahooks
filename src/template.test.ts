import { expect, test } from "bun:test";
import type { PlexPayload } from "./types.ts";
import { TEMPLATE_VAR_GROUPS, renderBody, renderHeaders, renderTemplate, templateVars } from "./template.ts";

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

const titanic: PlexPayload = {
  event: "media.play",
  owner: true,
  Account: { id: 1, title: "matt", thumb: "https://plex.tv/u/1.png" },
  Metadata: {
    type: "movie",
    title: "Titanic",
    summary: "A ship.",
    tagline: "Nothing on earth could come between them.",
    studio: "Paramount Pictures",
    contentRating: "PG-13",
    originalTitle: "Titanic (orig)",
    originallyAvailableAt: "1997-12-18",
    rating: 8.8,
    audienceRating: 6.9,
    duration: 11640000,
    viewOffset: 1020000,
    addedAt: 1709856000,
    lastViewedAt: 1709942400,
    viewCount: 2,
    Genre: [{ tag: "Drama" }, { tag: "Romance" }],
    Country: [{ tag: "United States of America" }],
    Director: [{ tag: "James Cameron" }],
    Writer: [{ tag: "James Cameron" }],
    Producer: [{ tag: "A" }, { tag: "B" }, { tag: "C" }, { tag: "D" }],
    Role: ["A", "B", "C", "D", "E", "F"].map((t) => ({ tag: `Actor ${t}`, role: `Role ${t}`, thumb: `t${t}.jpg` })),
    CommonSenseMedia: [{ oneLiner: "Too intense." }],
    Guid: [{ id: "imdb://tt0120338" }, { id: "tmdb://597" }, { id: "tvdb://231" }],
    Rating: [
      { image: "imdb://image.rating", value: 8 },
      { image: "themoviedb://image.rating", value: 7.9 },
    ],
  },
};

const r = (t: string, p: PlexPayload = titanic) => renderTemplate(`{{${t}}}`, p, { json: false });

test("people lists are capped: cast and cast_roles at 5, producers at 3", () => {
  expect(r("cast")).toBe("Actor A, Actor B, Actor C, Actor D, Actor E");
  expect(r("cast_roles").split(", ")).toHaveLength(5);
  expect(r("cast_roles")).toStartWith("Actor A as Role A, Actor B as Role B");
  expect(r("producers")).toBe("A, B, C");
  expect(r("directors")).toBe("James Cameron");
  expect(r("writers")).toBe("James Cameron");
});

test("title, rating, link and progress variables read the matching Plex fields", () => {
  expect(r("genres")).toBe("Drama, Romance");
  expect(r("countries")).toBe("United States of America");
  expect(r("imdb_rating")).toBe("8.0");
  expect(r("tmdb_rating")).toBe("7.9");
  expect(r("critic_rating")).toBe("8.8");
  expect(r("audience_rating")).toBe("6.9");
  expect(r("parent_guide")).toBe("Too intense.");
  expect(r("imdb_id")).toBe("tt0120338");
  expect(r("imdb_url")).toBe("https://www.imdb.com/title/tt0120338");
  expect(r("tvdb_id")).toBe("231");
  expect(r("duration")).toBe("3h 14m");
  expect(r("position")).toBe("17m");
  expect(r("progress")).toBe("9%");
  expect(r("remaining")).toBe("2h 57m left");
  expect(r("added_at")).toBe("2024-03-08T00:00:00.000Z");
  expect(r("last_watched_at")).toBe("2024-03-09T00:00:00.000Z");
  expect(r("view_count")).toBe("2");
  expect(r("is_owner")).toBe("true");
  expect(r("user_thumb")).toBe("https://plex.tv/u/1.png");
  expect(r("original_title")).toBe("Titanic (orig)");
  expect(r("release_date")).toBe("1997-12-18");
});

test("tmdb_url uses /movie/ for movies and /tv/ for episodes", () => {
  expect(r("tmdb_url")).toBe("https://www.themoviedb.org/movie/597");
  const ep: PlexPayload = { event: "media.play", Metadata: { ...titanic.Metadata, type: "episode", parentTitle: "Season 1" } };
  expect(r("tmdb_url", ep)).toBe("https://www.themoviedb.org/tv/597");
  expect(r("season_title", ep)).toBe("Season 1");
  expect(r("season_title")).toBe("");
});

test("new variables are empty when Plex omits the field", () => {
  const bare: PlexPayload = { event: "media.play", Metadata: { type: "movie", title: "X" } };
  for (const v of ["cast", "cast_roles", "genres", "imdb_id", "imdb_url", "tmdb_url", "imdb_rating", "parent_guide", "duration", "progress", "remaining", "added_at", "last_watched_at", "view_count", "is_owner", "tagline"]) {
    expect(r(v, bare)).toBe("");
  }
});

test("payload paths map over lists and join with commas; objects stay JSON", () => {
  expect(r("Metadata.Genre.tag")).toBe("Drama, Romance");
  expect(r("Metadata.summary")).toBe("A ship.");
  expect(r("Metadata.Role.thumb")).toStartWith("tA.jpg, tB.jpg");
  expect(r("Metadata.Guid.0.id")).toBe("imdb://tt0120338");
  expect(JSON.parse(r("Metadata.Genre"))).toEqual([{ tag: "Drama" }, { tag: "Romance" }]);
});

test("new variables are escaped in JSON bodies and flattened in headers", () => {
  const p: PlexPayload = { event: "media.play", Metadata: { tagline: 'a "b"\nc' } };
  expect(JSON.parse(renderBody('{"t":"{{tagline}}"}', p, {}))).toEqual({ t: 'a "b"\nc' });
  expect(renderHeaders({ X: "{{tagline}}" }, p)).toEqual({ X: 'a "b" c' });
});

test("every template variable belongs to a reference group", () => {
  const grouped = TEMPLATE_VAR_GROUPS.flatMap((g) => g.vars).toSorted();
  expect(grouped).toEqual(Object.keys(templateVars({ event: "" })).toSorted());
});
