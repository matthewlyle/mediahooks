import { Database } from "bun:sqlite";
import type {
  Delivery,
  DeliveryDetail,
  IncomingEvent,
  PlexPayload,
  Poster,
  RouteStatus,
  Routing,
  Session,
  Webhook,
  WebhookInput,
} from "./types.ts";
import { NEW_KEY, migrate } from "./migrations.ts";

const DELIVERY_LIMIT = 50;
const EVENT_LIMIT = 100;

type EventRow = {
  id: number;
  event: string;
  payload: string;
  routing: string;
  received_at: number;
  thumb_key: string | null;
};

const toEvent = (r: EventRow): IncomingEvent => ({
  id: r.id,
  event: r.event,
  payload: JSON.parse(r.payload),
  routing: (JSON.parse(r.routing) as (Omit<Routing, "status"> & { status?: RouteStatus })[]).map((x) => ({
    ...x,
    status: x.status ?? (x.reason === null ? "sent" : "skipped"),
  })),
  receivedAt: r.received_at,
  thumbKey: r.thumb_key,
});

type SessionRow = {
  token_hash: string;
  user_id: number;
  username: string;
  thumb: string;
  created_at: number;
  expires_at: number;
};

const toSession = (r: SessionRow): Session => ({
  userId: r.user_id,
  username: r.username,
  thumb: r.thumb,
  createdAt: r.created_at,
  expiresAt: r.expires_at,
});

type ThumbRow = { thumb: Uint8Array<ArrayBuffer>; thumb_type: string | null };

const toPoster = (r: ThumbRow): Poster => ({ bytes: r.thumb, type: r.thumb_type ?? "image/jpeg" });

type WebhookRow = {
  id: number;
  name: string;
  url: string;
  headers: string;
  body_template: string;
  events: string;
  users: string;
  libraries: string;
  enabled: number;
  attach_poster: number;
  created_at: number;
};

type DeliveryRow = {
  id: number;
  webhook_id: number;
  event: string;
  status: number | null;
  ok: number;
  error: string | null;
  duration_ms: number;
  attempts: number;
  created_at: number;
};

type DeliveryDetailRow = DeliveryRow & { request: string | null; response: string | null };

const DELIVERY_COLUMNS = "id, webhook_id, event, status, ok, error, duration_ms, attempts, created_at";

const toWebhook = (r: WebhookRow): Webhook => ({
  id: r.id,
  name: r.name,
  url: r.url,
  headers: JSON.parse(r.headers),
  bodyTemplate: r.body_template,
  events: JSON.parse(r.events),
  users: JSON.parse(r.users),
  libraries: JSON.parse(r.libraries),
  enabled: r.enabled === 1,
  attachPoster: r.attach_poster === 1,
  createdAt: r.created_at,
});

const toDelivery = (r: DeliveryRow): Delivery => ({
  id: r.id,
  webhookId: r.webhook_id,
  event: r.event,
  status: r.status,
  ok: r.ok === 1,
  error: r.error,
  durationMs: r.duration_ms,
  attempts: r.attempts,
  createdAt: r.created_at,
});

const toDeliveryDetail = (r: DeliveryDetailRow): DeliveryDetail => ({
  ...toDelivery(r),
  request: r.request === null ? null : JSON.parse(r.request),
  response: r.response === null ? null : JSON.parse(r.response),
});

const webhookParams = (w: WebhookInput) => ({
  name: w.name,
  url: w.url,
  headers: JSON.stringify(w.headers),
  body_template: w.bodyTemplate,
  events: JSON.stringify(w.events),
  users: JSON.stringify(w.users),
  libraries: JSON.stringify(w.libraries),
  enabled: w.enabled ? 1 : 0,
  attach_poster: w.attachPoster ? 1 : 0,
});

export interface Db {
  listWebhooks(): Webhook[];
  getWebhook(id: number): Webhook | null;
  createWebhook(input: WebhookInput): Webhook;
  updateWebhook(id: number, input: WebhookInput): Webhook | null;
  deleteWebhook(id: number): boolean;
  recordDelivery(d: Omit<DeliveryDetail, "id" | "createdAt">): Delivery;
  listDeliveries(webhookId: number): Delivery[];
  getDelivery(id: number): DeliveryDetail | null;
  latestDeliveries(): Map<number, Delivery>;
  recordEvent(payload: PlexPayload, routing: Routing[], poster: Poster | null): { id: number; thumbKey: string | null };
  updateRouting(eventId: number, routing: Routing[]): void;
  listEvents(): IncomingEvent[];
  getEvent(id: number): IncomingEvent | null;
  getThumb(key: string): Poster | null;
  latestThumb(): { thumbKey: string; poster: Poster } | null;
  latestEventAt(): number | null;
  getSetting(key: string): string | null;
  setSetting(key: string, value: string): void;
  createSession(tokenHash: string, s: Session): void;
  getSession(tokenHash: string, now: number): Session | null;
  extendSession(tokenHash: string, expiresAt: number): void;
  deleteSession(tokenHash: string): void;
}

export function openDb(path: string): Db {
  const db = new Database(path, { create: true, strict: true });
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA foreign_keys = ON");
  migrate(db);

  const q = {
    list: db.query<WebhookRow, []>("SELECT * FROM webhooks ORDER BY id"),
    get: db.query<WebhookRow, { id: number }>("SELECT * FROM webhooks WHERE id = $id"),
    create: db.query<WebhookRow, ReturnType<typeof webhookParams> & { created_at: number }>(
      `INSERT INTO webhooks (name, url, headers, body_template, events, users, libraries, enabled,
         attach_poster, created_at)
       VALUES ($name, $url, $headers, $body_template, $events, $users, $libraries, $enabled,
         $attach_poster, $created_at)
       RETURNING *`,
    ),
    update: db.query<WebhookRow, ReturnType<typeof webhookParams> & { id: number }>(
      `UPDATE webhooks SET name = $name, url = $url, headers = $headers,
         body_template = $body_template, events = $events, users = $users, libraries = $libraries,
         enabled = $enabled, attach_poster = $attach_poster
       WHERE id = $id RETURNING *`,
    ),
    delete: db.query<unknown, { id: number }>("DELETE FROM webhooks WHERE id = $id"),
    insertDelivery: db.query<DeliveryRow, Omit<DeliveryDetailRow, "id">>(
      `INSERT INTO deliveries (webhook_id, event, status, ok, error, duration_ms, attempts, created_at, request, response)
       VALUES ($webhook_id, $event, $status, $ok, $error, $duration_ms, $attempts, $created_at, $request, $response)
       RETURNING ${DELIVERY_COLUMNS}`,
    ),
    prune: db.query<unknown, { w: number; limit: number }>(
      `DELETE FROM deliveries WHERE webhook_id = $w AND id NOT IN
         (SELECT id FROM deliveries WHERE webhook_id = $w ORDER BY id DESC LIMIT $limit)`,
    ),
    deliveries: db.query<DeliveryRow, { w: number; limit: number }>(
      `SELECT ${DELIVERY_COLUMNS} FROM deliveries WHERE webhook_id = $w ORDER BY id DESC LIMIT $limit`,
    ),
    delivery: db.query<DeliveryDetailRow, { id: number }>("SELECT * FROM deliveries WHERE id = $id"),
    latest: db.query<DeliveryRow, []>(
      `SELECT ${DELIVERY_COLUMNS} FROM deliveries WHERE id IN (SELECT MAX(id) FROM deliveries GROUP BY webhook_id)`,
    ),
    insertEvent: db.query<
      { id: number; thumb_key: string | null },
      Omit<EventRow, "id" | "thumb_key"> & { thumb: Uint8Array | null; thumb_type: string | null }
    >(
      `INSERT INTO events (event, payload, routing, received_at, thumb, thumb_type, thumb_key)
       VALUES ($event, $payload, $routing, $received_at, $thumb, $thumb_type,
         CASE WHEN $thumb IS NULL THEN NULL ELSE ${NEW_KEY} END)
       RETURNING id, thumb_key`,
    ),
    updateRouting: db.query<unknown, { id: number; routing: string }>(
      "UPDATE events SET routing = $routing WHERE id = $id",
    ),
    pruneEvents: db.query<unknown, { limit: number }>(
      "DELETE FROM events WHERE id NOT IN (SELECT id FROM events ORDER BY id DESC LIMIT $limit)",
    ),
    events: db.query<EventRow, { limit: number }>(
      `SELECT id, event, payload, routing, received_at, thumb_key
       FROM events ORDER BY id DESC LIMIT $limit`,
    ),
    event: db.query<EventRow, { id: number }>(
      "SELECT id, event, payload, routing, received_at, thumb_key FROM events WHERE id = $id",
    ),
    thumb: db.query<ThumbRow, { key: string }>(
      "SELECT thumb, thumb_type FROM events WHERE thumb_key = $key AND thumb IS NOT NULL",
    ),
    latestThumb: db.query<ThumbRow & { thumb_key: string }, []>(
      "SELECT thumb, thumb_type, thumb_key FROM events WHERE thumb IS NOT NULL ORDER BY id DESC LIMIT 1",
    ),
    latestEventAt: db.query<{ at: number | null }, []>("SELECT MAX(received_at) AS at FROM events"),
    getSetting: db.query<{ value: string }, { key: string }>("SELECT value FROM settings WHERE key = $key"),
    setSetting: db.query<unknown, { key: string; value: string }>(
      `INSERT INTO settings (key, value) VALUES ($key, $value)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    ),
    insertSession: db.query<unknown, SessionRow>(
      `INSERT INTO sessions (token_hash, user_id, username, thumb, created_at, expires_at)
       VALUES ($token_hash, $user_id, $username, $thumb, $created_at, $expires_at)`,
    ),
    session: db.query<SessionRow, { hash: string; now: number }>(
      "SELECT * FROM sessions WHERE token_hash = $hash AND expires_at > $now",
    ),
    extendSession: db.query<unknown, { hash: string; expires: number }>(
      "UPDATE sessions SET expires_at = $expires WHERE token_hash = $hash",
    ),
    deleteSession: db.query<unknown, { hash: string }>("DELETE FROM sessions WHERE token_hash = $hash"),
    pruneSessions: db.query<unknown, { now: number }>("DELETE FROM sessions WHERE expires_at <= $now"),
  };

  return {
    listWebhooks: (): Webhook[] => q.list.all().map(toWebhook),
    getWebhook(id: number): Webhook | null {
      const row = q.get.get({ id });
      return row ? toWebhook(row) : null;
    },
    createWebhook(input: WebhookInput): Webhook {
      return toWebhook(q.create.get({ ...webhookParams(input), created_at: Date.now() })!);
    },
    updateWebhook(id: number, input: WebhookInput): Webhook | null {
      const row = q.update.get({ ...webhookParams(input), id });
      return row ? toWebhook(row) : null;
    },
    deleteWebhook: (id: number): boolean => q.delete.run({ id }).changes > 0,
    recordDelivery(d: Omit<DeliveryDetail, "id" | "createdAt">): Delivery {
      const row = q.insertDelivery.get({
        webhook_id: d.webhookId,
        event: d.event,
        status: d.status,
        ok: d.ok ? 1 : 0,
        error: d.error,
        duration_ms: d.durationMs,
        attempts: d.attempts,
        created_at: Date.now(),
        request: d.request === null ? null : JSON.stringify(d.request),
        response: d.response === null ? null : JSON.stringify(d.response),
      })!;
      q.prune.run({ w: d.webhookId, limit: DELIVERY_LIMIT });
      return toDelivery(row);
    },
    listDeliveries: (webhookId: number): Delivery[] =>
      q.deliveries.all({ w: webhookId, limit: DELIVERY_LIMIT }).map(toDelivery),
    getDelivery(id: number): DeliveryDetail | null {
      const row = q.delivery.get({ id });
      return row ? toDeliveryDetail(row) : null;
    },
    latestDeliveries: (): Map<number, Delivery> =>
      new Map(q.latest.all().map((r) => [r.webhook_id, toDelivery(r)])),
    recordEvent(payload: PlexPayload, routing: Routing[], poster: Poster | null): { id: number; thumbKey: string | null } {
      const row = q.insertEvent.get({
        event: payload.event,
        payload: JSON.stringify(payload),
        routing: JSON.stringify(routing),
        received_at: Date.now(),
        thumb: poster?.bytes ?? null,
        thumb_type: poster?.type ?? null,
      })!;
      q.pruneEvents.run({ limit: EVENT_LIMIT });
      return { id: row.id, thumbKey: row.thumb_key };
    },
    updateRouting(eventId: number, routing: Routing[]): void {
      q.updateRouting.run({ id: eventId, routing: JSON.stringify(routing) });
    },
    listEvents: (): IncomingEvent[] => q.events.all({ limit: EVENT_LIMIT }).map(toEvent),
    getEvent(id: number): IncomingEvent | null {
      const row = q.event.get({ id });
      return row ? toEvent(row) : null;
    },
    getThumb(key: string): Poster | null {
      const row = q.thumb.get({ key });
      return row ? toPoster(row) : null;
    },
    latestThumb() {
      const row = q.latestThumb.get();
      return row ? { thumbKey: row.thumb_key, poster: toPoster(row) } : null;
    },
    latestEventAt: (): number | null => q.latestEventAt.get()?.at ?? null,
    getSetting: (key: string): string | null => q.getSetting.get({ key })?.value ?? null,
    setSetting(key: string, value: string): void {
      q.setSetting.run({ key, value });
    },
    createSession(tokenHash: string, s: Session): void {
      q.pruneSessions.run({ now: s.createdAt });
      q.insertSession.run({
        token_hash: tokenHash,
        user_id: s.userId,
        username: s.username,
        thumb: s.thumb,
        created_at: s.createdAt,
        expires_at: s.expiresAt,
      });
    },
    getSession(tokenHash: string, now: number): Session | null {
      const row = q.session.get({ hash: tokenHash, now });
      if (!row) q.pruneSessions.run({ now });
      return row ? toSession(row) : null;
    },
    extendSession(tokenHash: string, expiresAt: number): void {
      q.extendSession.run({ hash: tokenHash, expires: expiresAt });
    },
    deleteSession(tokenHash: string): void {
      q.deleteSession.run({ hash: tokenHash });
    },
  };
}
