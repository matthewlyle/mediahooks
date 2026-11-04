import type { PlexPayload } from "./types.ts";

const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g;

const ACTIONS: Record<string, string> = {
  "media.play": "started",
  "media.resume": "resumed",
  "media.pause": "paused",
  "media.stop": "stopped",
  "media.scrobble": "finished",
  "media.rate": "rated",
  "library.new": "added",
  "library.on.deck": "has on deck",
  "playback.started": "started",
  "admin.database.backup": "backed up the database",
  "admin.database.corrupted": "found a corrupted database",
  "device.new": "connected a new device",
};

export type Metadata = NonNullable<PlexPayload["Metadata"]>;

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const pad2 = (n: number): string => String(n).padStart(2, "0");

function episodeCode(m: Metadata | undefined): string {
  if (m?.type !== "episode" || typeof m.parentIndex !== "number" || typeof m.index !== "number") return "";
  return `S${pad2(m.parentIndex)}E${pad2(m.index)}`;
}

function displayTitle(m: Metadata | undefined): string {
  if (!m) return "";
  const title = str(m.title);
  switch (m.type) {
    case "episode": {
      const head = [str(m.grandparentTitle), episodeCode(m)].filter(Boolean).join(" ");
      return [head, title].filter(Boolean).join(" · ");
    }
    case "movie":
      return typeof m.year === "number" ? `${title} (${m.year})` : title;
    case "track":
      return [str(m.grandparentTitle), title].filter(Boolean).join(" – ");
    case "album":
      return [str(m.parentTitle), title].filter(Boolean).join(" – ");
    case "season":
      return [str(m.parentTitle), title].filter(Boolean).join(" · ");
    default:
      return title;
  }
}

function plexUrl(p: PlexPayload): string {
  const server = p.Server?.uuid;
  const key = p.Metadata?.ratingKey;
  if (!server || (typeof key !== "string" && typeof key !== "number")) return "";
  return `https://app.plex.tv/desktop/#!/server/${server}/details?key=${encodeURIComponent(`/library/metadata/${key}`)}`;
}

const order = (v: unknown): number => (typeof v === "number" ? v : Number.POSITIVE_INFINITY);

function artist(m: Metadata | undefined): string {
  if (m?.type === "track") return str(m.grandparentTitle);
  if (m?.type === "album") return str(m.parentTitle);
  if (m?.type === "artist") return str(m.title);
  return "";
}

function album(m: Metadata | undefined): string {
  if (m?.type === "track") return str(m.parentTitle);
  if (m?.type === "album") return str(m.title);
  return "";
}

export function episodeList(episodes: Metadata[]): string {
  return episodes
    .toSorted((a, b) => order(a.parentIndex) - order(b.parentIndex) || order(a.index) - order(b.index))
    .map((m) => [episodeCode(m), str(m.title)].filter(Boolean).join(" · "))
    .join("\n");
}

export type TemplateContext = { thumbUrl?: string; now?: Date; group?: Metadata[] };

const names = (v: unknown, key: string, limit: number): string =>
  Array.isArray(v)
    ? v
      .map((e) => str((e as Record<string, unknown> | null)?.[key]))
      .filter(Boolean)
      .slice(0, limit)
      .join(", ")
    : "";

function castRoles(v: unknown): string {
  if (!Array.isArray(v)) return "";
  return v
    .slice(0, 5)
    .map((e) => {
      const r = e as Record<string, unknown> | null;
      return [str(r?.tag), str(r?.role)].filter(Boolean).join(" as ");
    })
    .filter(Boolean)
    .join(", ");
}

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const score = (v: unknown): string => (num(v) === undefined ? "" : (v as number).toFixed(1));

function externalId(m: Metadata | undefined, scheme: string): string {
  if (!Array.isArray(m?.Guid)) return "";
  const prefix = `${scheme}://`;
  for (const g of m.Guid) {
    const id = str((g as Record<string, unknown> | null)?.id);
    if (id.startsWith(prefix)) return id.slice(prefix.length);
  }
  return "";
}

function externalRating(m: Metadata | undefined, scheme: string): string {
  if (!Array.isArray(m?.Rating)) return "";
  for (const r of m.Rating) {
    const e = r as Record<string, unknown> | null;
    if (str(e?.image).startsWith(`${scheme}://`)) return score(e?.value);
  }
  return "";
}

function clock(ms: number | undefined): string {
  if (ms === undefined) return "";
  const minutes = Math.floor(ms / 60000);
  const h = Math.floor(minutes / 60);
  const min = minutes % 60;
  if (h === 0) return `${min}m`;
  return min === 0 ? `${h}h` : `${h}h ${min}m`;
}

function isoSeconds(v: unknown): string {
  const s = num(v);
  return s === undefined ? "" : new Date(s * 1000).toISOString();
}

function progress(m: Metadata | undefined) {
  const duration = num(m?.duration);
  const offset = num(m?.viewOffset);
  const known = duration !== undefined && duration > 0 && offset !== undefined;
  return {
    duration: clock(duration),
    position: clock(offset),
    progress: known ? `${Math.min(100, Math.round((offset / duration) * 100))}%` : "",
    remaining: known ? `${clock(Math.max(0, duration - offset))} left` : "",
  };
}

export function templateVars(p: PlexPayload, ctx: TemplateContext = {}): Record<string, unknown> {
  const m = p.Metadata;
  const group = ctx.group && ctx.group.length > 1 ? ctx.group : undefined;
  const tmdbId = externalId(m, "tmdb");
  const imdbId = externalId(m, "imdb");
  return {
    event: p.event,
    action: ACTIONS[p.event] ?? p.event,
    user: p.Account?.title,
    user_id: p.Account?.id,
    server: p.Server?.title,
    player: p.Player?.title,
    player_local: p.Player?.local,
    ip: p.Player?.publicAddress,
    display_title: group
      ? [str(m?.grandparentTitle), `${group.length} new episodes`].filter(Boolean).join(" · ")
      : displayTitle(m),
    title: m?.title,
    show: m?.grandparentTitle,
    season: m?.parentIndex,
    episode: m?.index,
    episode_code: episodeCode(m),
    count: group?.length ?? 1,
    episodes: group ? episodeList(group) : "",
    artist: artist(m),
    album: album(m),
    year: m?.year,
    type: m?.type,
    library: m?.librarySectionTitle,
    plex_url: plexUrl(p),
    thumb_url: ctx.thumbUrl,
    timestamp: (ctx.now ?? new Date()).toISOString(),
    summary: m?.summary,
    tagline: m?.tagline,
    genres: names(m?.Genre, "tag", Infinity),
    countries: names(m?.Country, "tag", Infinity),
    studio: m?.studio,
    content_rating: m?.contentRating,
    original_title: m?.originalTitle,
    release_date: m?.originallyAvailableAt,
    season_title: m?.type === "episode" ? m.parentTitle : "",
    cast: names(m?.Role, "tag", 5),
    cast_roles: castRoles(m?.Role),
    directors: names(m?.Director, "tag", Infinity),
    writers: names(m?.Writer, "tag", Infinity),
    producers: names(m?.Producer, "tag", 3),
    critic_rating: score(m?.rating),
    audience_rating: score(m?.audienceRating),
    imdb_rating: externalRating(m, "imdb"),
    tmdb_rating: externalRating(m, "themoviedb"),
    parent_guide: Array.isArray(m?.CommonSenseMedia) ? str((m.CommonSenseMedia[0] as Record<string, unknown> | undefined)?.oneLiner) : "",
    imdb_id: imdbId,
    imdb_url: imdbId ? `https://www.imdb.com/title/${imdbId}` : "",
    tmdb_id: tmdbId,
    tmdb_url: tmdbId ? `https://www.themoviedb.org/${m?.type === "movie" ? "movie" : "tv"}/${tmdbId}` : "",
    tvdb_id: externalId(m, "tvdb"),
    ...progress(m),
    added_at: isoSeconds(m?.addedAt),
    last_watched_at: isoSeconds(m?.lastViewedAt),
    view_count: m?.viewCount,
    user_thumb: p.Account?.thumb,
    is_owner: p.owner,
  };
}

export const TEMPLATE_VAR_GROUPS: { name: string; vars: string[] }[] = [
  { name: "Common", vars: ["display_title", "user", "action", "player", "plex_url", "thumb_url", "summary"] },
  {
    name: "Title",
    vars: [
      "title", "show", "season", "episode", "episode_code", "season_title", "count", "episodes", "artist", "album",
      "year", "type", "library", "tagline", "genres", "countries", "studio", "content_rating", "original_title",
      "release_date",
    ],
  },
  { name: "People", vars: ["cast", "cast_roles", "directors", "writers", "producers"] },
  { name: "Ratings", vars: ["critic_rating", "audience_rating", "imdb_rating", "tmdb_rating", "parent_guide"] },
  { name: "Links & IDs", vars: ["imdb_id", "imdb_url", "tmdb_id", "tmdb_url", "tvdb_id"] },
  {
    name: "Progress",
    vars: ["duration", "position", "progress", "remaining", "added_at", "last_watched_at", "view_count"],
  },
  {
    name: "User & server",
    vars: ["user_id", "user_thumb", "is_owner", "server", "ip", "player_local", "event", "timestamp"],
  },
];

export function isEmptyVar(v: unknown): boolean {
  return v === undefined || v === null || v === "";
}

function lookupPath(root: unknown, keys: string[]): unknown {
  if (keys.length === 0) return root;
  if (Array.isArray(root) && Number.isNaN(Number(keys[0]))) {
    const mapped = root.map((e) => lookupPath(e, keys)).filter((v) => v !== undefined);
    return mapped.every((v) => v === null || typeof v !== "object") ? mapped.join(", ") : mapped;
  }
  if (root === null || typeof root !== "object") return undefined;
  return lookupPath((root as Record<string, unknown>)[keys[0]!], keys.slice(1));
}

function renderValue(v: unknown, json: boolean): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return json ? JSON.stringify(v).slice(1, -1) : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

export function isJsonContentType(headers: Record<string, string>): boolean {
  const contentType = Object.entries(headers).find(([k]) => k.toLowerCase() === "content-type")?.[1];
  return contentType === undefined || contentType.toLowerCase().includes("json");
}

export function renderTemplate(
  template: string,
  p: PlexPayload,
  opts: { json?: boolean } & TemplateContext = {},
): string {
  const vars = templateVars(p, opts);
  const json = opts.json ?? true;
  return template.replace(PLACEHOLDER, (_, name: string) =>
    renderValue(Object.hasOwn(vars, name) ? vars[name] : lookupPath(p, name.split(".")), json),
  );
}

export function renderBody(
  template: string,
  p: PlexPayload,
  headers: Record<string, string>,
  ctx: TemplateContext = {},
): string {
  if (template.trim() === "") return "";
  return renderTemplate(template, p, { ...ctx, json: isJsonContentType(headers) });
}

export function renderHeaders(
  headers: Record<string, string>,
  p: PlexPayload,
  ctx: TemplateContext = {},
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, template] of Object.entries(headers)) {
    const value = renderTemplate(template, p, { ...ctx, json: false }).replace(/[\r\n]+/g, " ").trim();
    if (value) out[name] = value;
  }
  return out;
}
