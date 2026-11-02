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

export function templateVars(p: PlexPayload, ctx: TemplateContext = {}): Record<string, unknown> {
  const m = p.Metadata;
  const group = ctx.group && ctx.group.length > 1 ? ctx.group : undefined;
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
  };
}

export const TEMPLATE_VARS_HELP = Object.keys(templateVars({ event: "" }));

function lookupPath(root: unknown, path: string): unknown {
  let cur = root;
  for (const key of path.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
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
    renderValue(Object.hasOwn(vars, name) ? vars[name] : lookupPath(p, name), json),
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
