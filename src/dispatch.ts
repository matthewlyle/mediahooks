import type { Db } from "./db.ts";
import { explain } from "./filters.ts";
import { errorMessage, posterUrl, prepare, sentRequest, transmit, type Prepared, type SendContext, type SendResult } from "./send.ts";
import { episodeList } from "./template.ts";
import type { PlexPayload, Poster, Routing, Webhook } from "./types.ts";

export const RETRY_DELAYS_MS = [5_000, 20_000, 60_000];

const retryable = (r: SendResult) => !r.ok && (r.status === null || r.status >= 500 || r.status === 429);

export type Clock = {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
};

const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export const GROUP_QUIET_MS = 120_000;
export const GROUP_MAX_MS = 600_000;
export function groupKey(p: PlexPayload): string | null {
  const m = p.Metadata;
  if (p.event !== "library.new" || m?.type !== "episode") return null;
  const show = m.grandparentRatingKey ?? m.grandparentTitle;
  if ((typeof show !== "string" && typeof show !== "number") || show === "") return null;
  return `${p.Server?.uuid ?? ""}\n${show}`;
}

function span(ms: number): string {
  const minutes = ms / 60_000;
  if (Number.isInteger(minutes)) return minutes === 1 ? "1 minute" : `${minutes} minutes`;
  const seconds = Math.round(ms / 1000);
  return seconds === 1 ? "1 second" : `${seconds} seconds`;
}

export type DispatcherOptions = {
  publicUrl?: string;
  clock?: Clock;
  groupQuietMs?: number;
  groupMaxMs?: number;
  fetchPoster?: (p: PlexPayload) => Promise<Poster | null>;
};

type Held = { payload: PlexPayload; poster?: Poster; eventId: number; thumbKey: string | null };
type Group = { items: Held[]; firstAt: number; timer: unknown };

export interface Dispatcher {
  ingest(p: PlexPayload, poster?: Poster): Promise<void>;
  flushAll(): Promise<void>;
  idle(): Promise<void>;
  pending(): number;
}

export function createDispatcher(db: Db, opts: DispatcherOptions = {}): Dispatcher {
  const clock = opts.clock ?? systemClock;
  const quietMs = opts.groupQuietMs ?? GROUP_QUIET_MS;
  const maxMs = opts.groupMaxMs ?? GROUP_MAX_MS;
  const groups = new Map<string, Group>();
  const running = new Set<Promise<void>>();
  const retryWaits = new Set<{ timer: unknown; resolve: (go: boolean) => void }>();
  let stopping = false;

  function track(work: Promise<void>): Promise<void> {
    running.add(work);
    void work.finally(() => running.delete(work)).catch(() => {});
    return work;
  }

  function route(p: PlexPayload): { routing: Routing[]; targets: Webhook[] } {
    const webhooks = db.listWebhooks();
    const routing = webhooks.map((w): Routing => {
      const reason = w.enabled ? explain(w, p) : "disabled";
      return { webhookId: w.id, name: w.name, status: reason === null ? "sent" : "skipped", reason };
    });
    return { routing, targets: webhooks.filter((_, i) => routing[i]!.status === "sent") };
  }

  function retryWait(ms: number): Promise<boolean> {
    if (stopping) return Promise.resolve(false);
    const { promise, resolve } = Promise.withResolvers<boolean>();
    const entry = { timer: undefined as unknown, resolve };
    entry.timer = clock.setTimeout(() => {
      retryWaits.delete(entry);
      resolve(true);
    }, ms);
    retryWaits.add(entry);
    return promise;
  }

  async function deliver(w: Webhook, p: PlexPayload, ctx: SendContext): Promise<void> {
    let req: Prepared;
    try {
      req = prepare(w, p, ctx);
    } catch (err) {
      const error = errorMessage(err);
      db.recordDelivery({
        webhookId: w.id,
        event: p.event,
        status: null,
        ok: false,
        error,
        durationMs: 0,
        attempts: 1,
        request: null,
        response: null,
      });
      return;
    }
    let attempts = 1;
    let result = await transmit(req);
    for (const delay of RETRY_DELAYS_MS) {
      if (!retryable(result) || stopping) break;
      console.log(`${w.name}: retry ${attempts + 1} in ${delay / 1000}s (${result.status === null ? result.error : `HTTP ${result.status}`})`);
      if (!(await retryWait(delay))) break;
      attempts++;
      result = await transmit(req);
    }
    db.recordDelivery({ webhookId: w.id, event: p.event, attempts, request: sentRequest(req), ...result });
  }

  async function deliverAll(label: string, targets: Webhook[], p: PlexPayload, ctx: SendContext): Promise<void> {
    console.log(`${label} → ${targets.length} webhook(s)`);
    await Promise.allSettled(targets.map((w) => deliver(w, p, ctx)));
  }

  async function dispatchNow(p: PlexPayload, poster?: Poster): Promise<void> {
    const { routing, targets } = route(p);
    const { thumbKey } = db.recordEvent(p, routing, poster ?? null);
    const ctx: SendContext = poster ? { poster, thumbUrl: posterUrl(opts.publicUrl, thumbKey) } : {};
    await deliverAll(p.event, targets, p, ctx);
  }

  function accept(p: PlexPayload, poster?: Poster): Promise<void> {
    const key = groupKey(p);
    if (key === null) return track(dispatchNow(p, poster));
    hold(key, p, poster);
    return Promise.resolve();
  }

  async function serverPoster(p: PlexPayload): Promise<Poster | undefined> {
    try {
      return (await opts.fetchPoster?.(p)) ?? undefined;
    } catch (err) {
      console.log(`${p.event}: no poster from Plex (${(err as Error).message})`);
      return undefined;
    }
  }

  function hold(key: string, p: PlexPayload, poster?: Poster): void {
    const held = `held to group with other new episodes of ${p.Metadata?.grandparentTitle ?? "this show"}; sends after ${span(quietMs)} without another`;
    const routing = db.listWebhooks().map((w): Routing => {
      const reason = w.enabled ? explain(w, p) : "disabled";
      return reason === null
        ? { webhookId: w.id, name: w.name, status: "held", reason: held }
        : { webhookId: w.id, name: w.name, status: "skipped", reason };
    });
    const { id: eventId, thumbKey } = db.recordEvent(p, routing, poster ?? null);
    const now = clock.now();
    let group = groups.get(key);
    if (group) clock.clearTimeout(group.timer);
    else {
      group = { items: [], firstAt: now, timer: undefined };
      groups.set(key, group);
    }
    group.items.push({ payload: p, poster, eventId, thumbKey });
    group.timer = clock.setTimeout(
      () => void flush(key).catch(console.error),
      Math.max(0, Math.min(quietMs, group.firstAt + maxMs - now)),
    );
    console.log(`${p.event} → held (${group.items.length} for this show)`);
  }

  async function sendGroup(items: Held[]): Promise<void> {
    const first = items[0]!;
    const withPoster = items.find((i) => i.poster);
    const ctx: SendContext = withPoster
      ? { poster: withPoster.poster, thumbUrl: posterUrl(opts.publicUrl, withPoster.thumbKey) }
      : {};
    if (items.length === 1) {
      const { routing, targets } = route(first.payload);
      db.updateRouting(first.eventId, routing);
      return deliverAll(first.payload.event, targets, first.payload, ctx);
    }
    const group = items.map((i) => i.payload.Metadata ?? {});
    const payload: PlexPayload = {
      ...first.payload,
      Metadata: { ...first.payload.Metadata, summary: episodeList(group) },
    };
    const { routing, targets } = route(payload);
    db.updateRouting(first.eventId, routing);
    const grouped = `sent in one message for ${items.length} new episodes with event #${first.eventId}`;
    for (const item of items.slice(1)) {
      db.updateRouting(
        item.eventId,
        routing.map((r): Routing => (r.status === "sent" ? { ...r, status: "grouped", reason: grouped } : r)),
      );
    }
    await deliverAll(`${payload.event} (${items.length} grouped)`, targets, payload, { ...ctx, group });
  }

  function flush(key: string): Promise<void> {
    const group = groups.get(key);
    if (!group) return Promise.resolve();
    groups.delete(key);
    clock.clearTimeout(group.timer);
    return track(sendGroup(group.items));
  }

  async function idle(): Promise<void> {
    await Promise.allSettled([...running]);
  }

  return {
    async ingest(p: PlexPayload, attached?: Poster): Promise<void> {
      if (!opts.fetchPoster) return accept(p, attached);
      return track(serverPoster(p).then((fetched) => accept(p, fetched ?? attached)));
    },
    async flushAll(): Promise<void> {
      stopping = true;
      for (const wait of retryWaits) {
        clock.clearTimeout(wait.timer);
        wait.resolve(false);
      }
      retryWaits.clear();
      await idle();
      await Promise.allSettled([...groups.keys()].map(flush));
      await idle();
    },
    idle,
    pending: (): number => groups.size,
  };
}
