import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { IncomingEvent, RouteStatus } from "../../src/types.ts";
import { EmptyState } from "../ui/EmptyState.tsx";
import { templateVars } from "../../src/template.ts";
import { RefreshButton, type RefreshOutcome } from "../ui/RefreshButton.tsx";
import { RelativeTime } from "../ui/RelativeTime.tsx";
import { api } from "../lib/api.ts";
import { EASE, SPRING, flash, pageTransition } from "../lib/motion.ts";
import { useEscape, useNav, useRouteHeading } from "../lib/nav.ts";
import { useRefetchOnReturn } from "../lib/refetch.ts";
import "./EventsPage.css";

const HEIGHT_IN = { duration: 0.3, ease: [0.25, 1, 0.5, 1] } as const;
const HEIGHT_OUT = { duration: 0.2, ease: EASE.outQuint } as const;
const FADE_IN = { duration: 0.2, ease: EASE.css } as const;
const FADE_OUT = { duration: 0.12, ease: EASE.css } as const;

let cached: IncomingEvent[] | null = null;
let cachedAt: number | null = null;

export function EventsPage() {
  const heading = useRouteHeading<HTMLHeadingElement>();
  const navigate = useNav();
  const [events, setEvents] = useState<IncomingEvent[] | null>(cached);
  const [updatedAt, setUpdatedAt] = useState<number | null>(cachedAt);
  const [error, setError] = useState<string | null>(null);
  const initialIds = useRef<Set<number> | null>(cached && new Set(cached.map((e) => e.id)));

  useEscape(() => navigate("/", { instant: true }));

  async function load(): Promise<RefreshOutcome> {
    const res = await api<IncomingEvent[]>("/api/events");
    if (!res.ok) {
      if (!events) setError(res.error);
      return { ok: false, error: res.error };
    }
    const shown = new Set((events ?? []).map((e) => e.id));
    cached = res.data;
    cachedAt = Date.now();
    initialIds.current ??= new Set(res.data.map((e) => e.id));
    setError(null);
    setEvents(res.data);
    setUpdatedAt(cachedAt);
    return { ok: true, added: events ? res.data.filter((e) => !shown.has(e.id)).length : 0 };
  }

  useEffect(() => {
    void load();
  }, []);
  useRefetchOnReturn(load);

  return (
    <motion.div className="page page-events" {...pageTransition}>
      <h2 ref={heading} tabIndex={-1} className="sr-only">Events</h2>
      <section className="panel events-panel" aria-label="Recent events">
        <div className="ev-head">
          <RefreshButton onRefresh={load} updatedAt={updatedAt} noun={["event", "events"]} disabled={!events && !error} />
        </div>
        <AnimatePresence initial={false}>
          {(events || error) && (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={FADE_IN}>
              {!events ? (
                <EmptyState size="medium">Couldn't load events: {error}</EmptyState>
              ) : events.length === 0 ? (
                <EmptyState size="medium">No Plex events yet</EmptyState>
              ) : (
                <div className="ev-cols" aria-hidden="true">
                  <span>Time</span>
                  <span>Event</span>
                  <span>User</span>
                  <span>Title</span>
                  <span>Library</span>
                  <span>Sent to</span>
                </div>
              )}
              {events && (
                <ul className="ev-list">
                  <AnimatePresence initial={false}>
                    {events.map((e) => (
                      <EventRow key={e.id} e={e} fresh={!initialIds.current?.has(e.id)} />
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </motion.div>
  );
}

function EventRow({ e, fresh }: { e: IncomingEvent; fresh: boolean }) {
  const reduce = useReducedMotion();
  const row = useRef<HTMLLIElement>(null);
  const [open, setOpen] = useState(false);
  const vars = useMemo(() => templateVars(e.payload), [e.payload]);
  const sent = e.routing.filter((r) => r.status === "sent" || r.status === "grouped").map((r) => r.name);
  const held = e.routing.some((r) => r.status === "held");
  const detailId = `event-${e.id}-detail`;

  useEffect(() => {
    if (fresh) flash(row.current);
  }, []);

  return (
    <motion.li
      ref={row}
      className={open ? "ev-row open" : "ev-row"}
      layout="position"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: FADE_OUT }}
      transition={{ ...SPRING.page, layout: SPRING.morph }}
    >
      <button
        type="button"
        className="ev-summary"
        aria-expanded={open}
        aria-controls={open ? detailId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="sr-only">Time: </span>
        <span className="ev-time">
          <RelativeTime ms={e.receivedAt} />
        </span>
        <span className="sr-only">Event: </span>
        <code className="ev-event">{e.event}</code>
        {vars.user ? <span className="sr-only">User: </span> : null}
        <span className="ev-user">{text(vars.user)}</span>
        {vars.display_title ? <span className="sr-only">Title: </span> : null}
        <span className="ev-title">
          {e.thumbKey && <img className="ev-poster" src={`/thumbs/${e.thumbKey}`} alt="" loading="lazy" />}
          <span className="ev-title-text">{text(vars.display_title)}</span>
        </span>
        {vars.library ? <span className="sr-only">Library: </span> : null}
        <span className="ev-library">{text(vars.library)}</span>
        <span className="sr-only">Sent to: </span>
        <span className={sent.length ? "ev-sent" : "ev-sent muted"}>
          {sent.length ? sent.join(", ") : held ? "Waiting to group" : "None"}
        </span>
      </button>
      <AnimatePresence>{open && <EventDetail key="detail" id={detailId} e={e} />}</AnimatePresence>
    </motion.li>
  );
}

function EventDetail({ id, e }: { id: string; e: IncomingEvent }) {
  const reduce = useReducedMotion();
  const [inner, height] = useHeight<HTMLDivElement>();
  return (
    <motion.div
      id={id}
      className="ev-detail-clip"
      initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, height: height ?? 0 }}
      exit={
        reduce
          ? { opacity: 0, transition: FADE_OUT }
          : { opacity: 0, height: 0, transition: { height: HEIGHT_OUT, opacity: FADE_OUT } }
      }
      transition={{ height: HEIGHT_IN, opacity: FADE_IN }}
    >
      <div ref={inner} className="ev-detail">
        {e.routing.length ? (
          <ul className="ev-routing">
            {e.routing.map((r) => (
              <li key={r.webhookId} className={MARKS[r.status].className}>
                <span className="mark" aria-hidden="true">
                  {MARKS[r.status].mark}
                </span>
                <strong>{r.name}</strong>
                {r.reason === null ? " sent" : `: ${r.reason}`}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No webhooks existed when this arrived.</p>
        )}
        <span className="label">Payload</span>
        <pre className="ev-payload mono">{JSON.stringify(e.payload, null, 2)}</pre>
      </div>
    </motion.div>
  );
}

const text = (v: unknown): string => (v === undefined || v === null ? "" : String(v));

const MARKS: Record<RouteStatus, { mark: string; className: string }> = {
  sent: { mark: "✓", className: "ok" },
  grouped: { mark: "✓", className: "ok" },
  held: { mark: "◷", className: "pending" },
  skipped: { mark: "✗", className: "skipped" },
};

function useHeight<T extends HTMLElement>(): [RefObject<T | null>, number | null] {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setHeight(el.offsetHeight);
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, height];
}
