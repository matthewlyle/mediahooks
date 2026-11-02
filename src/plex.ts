import { error } from "./http.ts";
import type { PlexLibrary, PlexPayload, PlexUser, Poster } from "./types.ts";

export class PlexError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}

export type PlexAccount = { id: number; username: string; title: string; thumb: string };

export async function plexErrors(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof PlexError) return error(err.message, err.status);
    throw err;
  }
}

export function posterPath(p: PlexPayload): string | null {
  const m = p.Metadata;
  const path =
    m?.type === "episode"
      ? (m.grandparentThumb ?? m.parentThumb ?? m.thumb)
      : m?.type === "track"
        ? (m.parentThumb ?? m.thumb ?? m.grandparentThumb)
        : m?.thumb;
  return typeof path === "string" && path !== "" ? path : null;
}

export type PlexClientOptions = { plexTvUrl: string; plexUrl: string; clientId: string };

export interface PlexClient {
  createPin(): Promise<{ id: number; code: string }>;
  pinToken(id: number): Promise<string | null>;
  account(token: string): Promise<PlexAccount>;
  ownsServer(token: string): Promise<boolean>;
  users(token: string): Promise<PlexUser[]>;
  libraries(token: string): Promise<PlexLibrary[]>;
  poster(token: string, path: string): Promise<Poster>;
}

const CACHE_MS = 5 * 60_000;
const TIMEOUT_MS = 10_000;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

const decodeXml = (s: string) =>
  s.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (match, e: string) => {
    if (e[0] !== "#") return ENTITIES[e] ?? match;
    return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
  });

function xmlAttributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [, key, value] of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) out[key!] = decodeXml(value!);
  return out;
}

export function parseSharedUsers(xml: string): { attrs: Record<string, string>; servers: string[] }[] {
  return [...xml.matchAll(/<User\b([^>]*?)(?:\/>|>([\s\S]*?)<\/User>)/g)].map(([, attrs, inner]) => ({
    attrs: xmlAttributes(attrs!),
    servers: [...(inner ?? "").matchAll(/<Server\b([^>]*?)\/?>/g)].map(([, a]) => xmlAttributes(a!).machineIdentifier ?? ""),
  }));
}

function cached<T>(load: (token: string) => Promise<T>): (token: string) => Promise<T> {
  let entry: { token: string; at: number; value: T } | null = null;
  return async (token) => {
    if (entry && entry.token === token && Date.now() - entry.at < CACHE_MS) return entry.value;
    const value = await load(token);
    entry = { token, at: Date.now(), value };
    return value;
  };
}

export function createPlexClient(opts: PlexClientOptions): PlexClient {
  const tv = opts.plexTvUrl.replace(/\/+$/, "");
  const pms = opts.plexUrl.replace(/\/+$/, "");

  async function request(
    base: string,
    path: string,
    init: { method?: string; token?: string; accept?: string; timeoutMs?: number } = {},
  ): Promise<Response> {
    const headers: Record<string, string> = {
      accept: init.accept ?? "application/json",
      "x-plex-product": "mediahooks",
      "x-plex-client-identifier": opts.clientId,
    };
    if (init.token) headers["x-plex-token"] = init.token;
    try {
      return await fetch(base + path, {
        method: init.method ?? "GET",
        headers,
        signal: AbortSignal.timeout(init.timeoutMs ?? TIMEOUT_MS),
      });
    } catch {
      throw new PlexError(base === tv ? "Couldn't reach plex.tv." : "Couldn't reach your Plex server. Check PLEX_URL.");
    }
  }

  async function json<T>(res: Response, what: string): Promise<T> {
    if (!res.ok) throw new PlexError(`${what} failed (HTTP ${res.status}).`);
    try {
      return (await res.json()) as T;
    } catch {
      throw new PlexError(`${what} returned an unexpected response.`);
    }
  }

  let machineIdentifier: string | null = null;
  async function machineId(): Promise<string> {
    if (machineIdentifier) return machineIdentifier;
    const body = await json<{ MediaContainer?: { machineIdentifier?: string } }>(
      await request(pms, "/identity"),
      "Plex server identity",
    );
    const id = body.MediaContainer?.machineIdentifier;
    if (!id) throw new PlexError("Plex server identity returned an unexpected response.");
    machineIdentifier = id;
    return id;
  }

  async function account(token: string): Promise<PlexAccount> {
    const res = await request(tv, "/api/v2/user", { token });
    if (res.status === 401) throw new PlexError("Plex didn't accept the sign-in.", 403);
    const u = await json<{ id: number; username?: string; title?: string; thumb?: string }>(res, "Plex account");
    return { id: u.id, username: u.username || u.title || "", title: u.title || u.username || "", thumb: u.thumb ?? "" };
  }

  async function loadUsers(token: string): Promise<PlexUser[]> {
    const [owner, homeRes, sharedRes, mid] = await Promise.all([
      account(token),
      request(tv, "/api/v2/home/users", { token }).catch(() => null),
      request(tv, "/api/users", { token }),
      machineId(),
    ]);
    if (!sharedRes.ok) throw new PlexError(`Plex users failed (HTTP ${sharedRes.status}).`);
    const shared = parseSharedUsers(await sharedRes.text())
      .filter(({ attrs, servers }) => attrs.home === "1" || servers.includes(mid))
      .map(({ attrs }) => ({ id: Number(attrs.id), title: attrs.title || attrs.username || "", thumb: attrs.thumb ?? "" }));

    let home: PlexUser[] = [];
    if (homeRes?.ok) {
      const body = (await homeRes.json().catch(() => null)) as
        | { users?: { id: number; title?: string; username?: string; thumb?: string }[] }
        | null;
      home = (body?.users ?? []).map((u) => ({ id: u.id, title: u.title || u.username || "", thumb: u.thumb ?? "" }));
    }

    const seen = new Set<number>([owner.id]);
    const others = [...home, ...shared].filter((u) => u.title && Number.isFinite(u.id) && !seen.has(u.id) && seen.add(u.id));
    others.sort((a, b) => a.title.localeCompare(b.title));
    return [{ id: owner.id, title: owner.title, thumb: owner.thumb }, ...others];
  }

  async function loadLibraries(token: string): Promise<PlexLibrary[]> {
    const body = await json<{ MediaContainer?: { Directory?: { key: string; title: string; type: string }[] } }>(
      await request(pms, "/library/sections", { token }),
      "Plex libraries",
    );
    return (body.MediaContainer?.Directory ?? []).map((d) => ({ id: Number(d.key), title: d.title, type: d.type }));
  }

  async function poster(token: string, path: string): Promise<Poster> {
    const query = `width=600&height=900&minSize=1&upscale=1&url=${encodeURIComponent(path)}`;
    const res = await request(pms, `/photo/:/transcode?${query}`, { token, accept: "image/jpeg", timeoutMs: 5000 });
    const type = res.headers.get("content-type") ?? "image/jpeg";
    if (!res.ok || !type.startsWith("image/")) throw new PlexError(`Plex poster failed (HTTP ${res.status}).`);
    const bytes = await res.bytes();
    if (bytes.length === 0) throw new PlexError("Plex poster was empty.");
    return { bytes, type };
  }

  return {
    async createPin(): Promise<{ id: number; code: string }> {
      const pin = await json<{ id: number; code: string }>(
        await request(tv, "/api/v2/pins?strong=true", { method: "POST" }),
        "Plex sign-in",
      );
      return { id: pin.id, code: pin.code };
    },
    async pinToken(id: number): Promise<string | null> {
      const res = await request(tv, `/api/v2/pins/${id}`);
      if (res.status === 404) throw new PlexError("Sign-in expired. Try again.", 410);
      const pin = await json<{ authToken?: string | null }>(res, "Plex sign-in");
      return pin.authToken || null;
    },
    account,
    async ownsServer(token: string): Promise<boolean> {
      const mid = await machineId();
      const resources = await json<{ clientIdentifier?: string; owned?: boolean }[]>(
        await request(tv, "/api/v2/resources?includeHttps=1", { token }),
        "Plex servers",
      );
      return resources.some((r) => r.clientIdentifier === mid && r.owned === true);
    },
    users: cached(loadUsers),
    libraries: cached(loadLibraries),
    poster,
  };
}
