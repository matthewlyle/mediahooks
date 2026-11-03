import type { HTMLBundle, Server } from "bun";
import { version } from "../package.json";
import { clientId, createAuth } from "./auth.ts";
import type { Db } from "./db.ts";
import { createDispatcher, type Dispatcher } from "./dispatch.ts";
import { matches, type Filters } from "./filters.ts";
import { error, notFound, parseId, readJson } from "./http.ts";
import { createIngest } from "./ingest.ts";
import { createPlexClient, plexErrors, posterPath } from "./plex.ts";
import { SAMPLE_PAYLOAD } from "./sample.ts";
import { maskWebhook, unmask } from "./secrets.ts";
import { posterUrl, send, type SendContext } from "./send.ts";
import { TEMPLATE_VARS_HELP } from "./template.ts";
import { PLEX_EVENTS, type PlexPayload, type Webhook, type WebhookListItem } from "./types.ts";
import { validateWebhook } from "./validate.ts";

export type AppConfig = {
  port: number;
  db: Db;
  index: HTMLBundle | Response;
  publicUrl?: string;
  groupQuietMs?: number;
  groupMaxMs?: number;
  auth: boolean;
  plexUrl: string;
  plexTvUrl: string;
};

export type App = { server: Server<undefined>; dispatcher: Dispatcher };

const PUBLIC_DIR = new URL("../public/", import.meta.url);

const asset = (path: string, type: string) => () =>
  new Response(Bun.file(new URL(path, PUBLIC_DIR)), { headers: { "content-type": type, "cache-control": "public, max-age=86400" } });

export function createApp(config: AppConfig): App {
  const { db, index, publicUrl } = config;
  const cid = clientId(db);
  const plex = createPlexClient({ plexTvUrl: config.plexTvUrl, plexUrl: config.plexUrl, clientId: cid });
  const auth = createAuth({ db, plex, enabled: config.auth, clientId: cid });
  const dispatcher = createDispatcher(db, {
    publicUrl,
    groupQuietMs: config.groupQuietMs,
    groupMaxMs: config.groupMaxMs,
    fetchPoster: async (p) => {
      const owner = auth.ownerToken();
      const path = posterPath(p);
      return owner && path ? plex.poster(owner, path) : null;
    },
  });
  const ingest = createIngest(db, dispatcher);

  function testEvent(body: unknown, filters: Filters): { payload: PlexPayload; ctx: SendContext } {
    const eventId = (body as { eventId?: unknown } | null)?.eventId;
    const e =
      typeof eventId === "number"
        ? db.getEvent(eventId)
        : eventId === undefined
          ? (db.listEvents().find((x) => matches(filters, x.payload)) ?? null)
          : null;
    if (!e) return { payload: SAMPLE_PAYLOAD, ctx: {} };
    const poster = e.thumbKey ? db.getThumb(e.thumbKey) : null;
    return { payload: e.payload, ctx: poster ? { poster, thumbUrl: posterUrl(publicUrl, e.thumbKey) } : {} };
  }

  function savedFrom(body: unknown): Webhook | null {
    const id = (body as { id?: unknown } | null)?.id;
    return typeof id === "number" ? db.getWebhook(id) : null;
  }

  function webhookInput(body: unknown, saved: Webhook | null) {
    const v = validateWebhook(body);
    return v.ok ? unmask(v.value, saved) : v;
  }

  function withOwnerToken(load: (token: string) => Promise<unknown>): Promise<Response> {
    const token = auth.ownerToken();
    if (!token) return Promise.resolve(error("Sign in with Plex first.", 503));
    return plexErrors(async () => Response.json(await load(token)));
  }

  const server = Bun.serve({
    port: config.port,
    routes: auth.protect({
      "/": index,
      "/new": index,
      "/events": index,
      "/help": index,
      "/webhooks/:id": index,
      "/webhooks/:id/edit": index,
      "/plex": { POST: (req) => ingest.handle(req) },
      "/icons/icon-192.png": asset("icons/icon-192.png", "image/png"),
      "/icons/icon-512.png": asset("icons/icon-512.png", "image/png"),
      "/healthz": {
        GET: () => {
          try {
            db.latestEventAt();
            return new Response("ok");
          } catch (err) {
            return new Response(`database unavailable: ${(err as Error).message}`, { status: 503 });
          }
        },
      },
      ...auth.routes,
      "/api/meta": {
        GET: () =>
          Response.json({
            version,
            events: PLEX_EVENTS,
            templateVars: TEMPLATE_VARS_HELP,
            ingestToken: ingest.token(),
          }),
      },
      "/api/ingest-token": {
        POST: () => Response.json({ ingestToken: ingest.replaceToken() }),
      },
      "/api/plex/libraries": { GET: () => withOwnerToken(plex.libraries) },
      "/api/plex/users": { GET: () => withOwnerToken(plex.users) },
      "/api/webhooks": {
        GET: () => {
          const latest = db.latestDeliveries();
          const items: WebhookListItem[] = db
            .listWebhooks()
            .map((w) => maskWebhook({ ...w, lastDelivery: latest.get(w.id) ?? null }));
          return Response.json(items);
        },
        POST: async (req) => {
          const parsed = await readJson(req);
          if (!parsed.ok) return error("invalid JSON", 400);
          const v = webhookInput(parsed.body, savedFrom(parsed.body));
          if (!v.ok) return error(v.error, 400);
          return Response.json(maskWebhook(db.createWebhook(v.value)), { status: 201 });
        },
      },
      "/api/status": {
        GET: () => Response.json({ lastEventAt: db.latestEventAt() }),
      },
      "/api/events": {
        GET: () => Response.json(db.listEvents()),
      },
      "/thumbs/:key": {
        GET: (req) => {
          const poster = db.getThumb(req.params.key);
          if (!poster) return notFound();
          return new Response(poster.bytes, {
            headers: { "content-type": poster.type, "cache-control": "public, max-age=86400" },
          });
        },
      },
      "/api/send-test": {
        POST: async (req) => {
          const parsed = await readJson(req);
          if (!parsed.ok) return error("invalid JSON", 400);
          const v = webhookInput(parsed.body, savedFrom(parsed.body));
          if (!v.ok) return error(v.error, 400);
          const { payload, ctx } = testEvent(parsed.body, v.value);
          return Response.json(await send(v.value, payload, ctx));
        },
      },
      "/api/webhooks/:id": {
        PUT: async (req) => {
          const id = parseId(req.params.id);
          if (id === null) return notFound();
          const parsed = await readJson(req);
          if (!parsed.ok) return error("invalid JSON", 400);
          const saved = db.getWebhook(id);
          if (!saved) return notFound();
          const v = webhookInput(parsed.body, saved);
          if (!v.ok) return error(v.error, 400);
          const updated = db.updateWebhook(id, v.value);
          return updated ? Response.json(maskWebhook(updated)) : notFound();
        },
        DELETE: (req) => {
          const id = parseId(req.params.id);
          if (id === null || !db.deleteWebhook(id)) return notFound();
          return new Response(null, { status: 204 });
        },
      },
      "/api/webhooks/:id/deliveries": {
        GET: (req) => {
          const id = parseId(req.params.id);
          if (id === null) return notFound();
          return Response.json(db.listDeliveries(id));
        },
      },
      "/api/deliveries/:id": {
        GET: (req) => {
          const id = parseId(req.params.id);
          const delivery = id === null ? null : db.getDelivery(id);
          return delivery ? Response.json(delivery) : notFound();
        },
      },
    }),
    fetch: notFound,
  });

  return { server, dispatcher };
}
