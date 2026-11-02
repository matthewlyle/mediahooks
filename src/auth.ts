import type { BunRequest, Serve } from "bun";
import type { Db } from "./db.ts";
import { error, notFound } from "./http.ts";
import type { AuthUser, Session } from "./types.ts";
import { plexErrors, type PlexClient } from "./plex.ts";

export const SESSION_COOKIE = "mediahooks_session";
const SESSION_MS = 30 * 24 * 60 * 60_000;
const SLIDE_MS = 60 * 60_000;
const MUTATING: Record<string, true> = { POST: true, PUT: true, PATCH: true, DELETE: true };
const NOT_OWNER = "This Plex account doesn't own this server.";

export function clientId(db: Db): string {
  const existing = db.getSetting("client_id");
  if (existing) return existing;
  const id = crypto.randomUUID();
  db.setSetting("client_id", id);
  return id;
}

export const authUrl = (cid: string, code: string) =>
  `https://app.plex.tv/auth#?clientID=${encodeURIComponent(cid)}&code=${encodeURIComponent(code)}&context%5Bdevice%5D%5Bproduct%5D=mediahooks`;

const hash = (token: string) => new Bun.CryptoHasher("sha256").update(token).digest("hex");

// Sec-Fetch-Site doesn't depend on Host, which reverse proxies may rewrite.
function sameOrigin(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site !== null) return site === "same-origin" || site === "none";
  const origin = req.headers.get("origin");
  if (origin === null) return true;
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

export type AuthOptions = { db: Db; plex: PlexClient; enabled: boolean; clientId: string };

type Handler = (req: BunRequest, server: unknown) => Response | Promise<Response>;

export interface Auth {
  protect<R extends string>(routes: Serve.Routes<undefined, R>): Serve.Routes<undefined, R>;
  routes: Serve.Routes<undefined, "/api/auth/pin" | "/api/auth/pin/:id" | "/api/auth/me" | "/api/auth/signout">;
  ownerToken(): string | null;
}

export function createAuth({ db, plex, enabled, clientId: cid }: AuthOptions): Auth {
  function setCookie(req: BunRequest, token: string, expiresAt: number) {
    req.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure:
        new URL(req.url).protocol === "https:" ||
        req.headers.get("x-forwarded-proto") === "https" ||
        req.headers.get("origin")?.startsWith("https:") === true,
      maxAge: Math.floor((expiresAt - Date.now()) / 1000),
    });
  }

  function session(req: BunRequest): Session | null {
    const token = req.cookies.get(SESSION_COOKIE);
    if (!token) return null;
    const tokenHash = hash(token);
    const now = Date.now();
    const s = db.getSession(tokenHash, now);
    if (!s) return null;
    if (s.expiresAt - now > SESSION_MS - SLIDE_MS) return s;
    const expiresAt = now + SESSION_MS;
    db.extendSession(tokenHash, expiresAt);
    setCookie(req, token, expiresAt);
    return { ...s, expiresAt };
  }

  function wrap(handler: Handler, open: boolean): Handler {
    return (req, server) => {
      if (MUTATING[req.method] && !sameOrigin(req)) return error("cross-origin request", 403);
      if (enabled && !open && !session(req)) return error("sign in required", 401);
      return handler(req, server);
    };
  }

  return {
    protect(routes) {
      const out: Record<string, unknown> = {};
      for (const [path, value] of Object.entries(routes)) {
        if (!path.startsWith("/api/")) out[path] = value;
        else {
          const open = path.startsWith("/api/auth/");
          out[path] =
            typeof value === "function"
              ? wrap(value as Handler, open)
              : Object.fromEntries(
                  Object.entries(value as Record<string, Handler>).map(([method, h]) => [method, wrap(h, open)]),
                );
        }
      }
      return out as typeof routes;
    },
    routes: {
      "/api/auth/pin": {
        POST: () => {
          if (!enabled) return error("auth is off", 404);
          return plexErrors(async () => {
            const pin = await plex.createPin();
            return Response.json({ id: pin.id, code: pin.code, authUrl: authUrl(cid, pin.code) });
          });
        },
      },
      "/api/auth/pin/:id": {
        POST: (req) => {
          if (!enabled) return error("auth is off", 404);
          const id = Number(req.params.id);
          if (!Number.isInteger(id)) return notFound();
          return plexErrors(async () => {
            const plexToken = await plex.pinToken(id);
            if (!plexToken) return Response.json({ status: "waiting" });
            const account = await plex.account(plexToken);
            if (!(await plex.ownsServer(plexToken))) return error(NOT_OWNER, 403);
            db.setSetting("owner_token", plexToken);
            const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
            const now = Date.now();
            const user: AuthUser = { username: account.username, thumb: account.thumb };
            db.createSession(hash(token), { ...user, userId: account.id, createdAt: now, expiresAt: now + SESSION_MS });
            setCookie(req, token, now + SESSION_MS);
            return Response.json({ status: "signed-in", user });
          });
        },
      },
      "/api/auth/me": {
        GET: (req) => {
          if (!enabled) return Response.json({ user: null });
          const s = session(req);
          if (!s) return error("sign in required", 401);
          return Response.json({ user: { username: s.username, thumb: s.thumb } satisfies AuthUser });
        },
      },
      "/api/auth/signout": {
        POST: (req) => {
          const token = req.cookies.get(SESSION_COOKIE);
          if (token) db.deleteSession(hash(token));
          req.cookies.delete({ name: SESSION_COOKIE, path: "/" });
          return new Response(null, { status: 204 });
        },
      },
    },
    ownerToken: () => db.getSetting("owner_token"),
  };
}
