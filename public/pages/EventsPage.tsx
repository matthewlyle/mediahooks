import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { IncomingEvent, RouteStatus } from "../../src/types.ts";
import { EmptyState } from "../ui/EmptyState.tsx";
import { CodeBlock } from "../ui/CodeBlock.tsx";
import { templateVars } from "../../src/template.ts";
import { Panel } from "../ui/Panel.tsx";
import { RefreshButton, type RefreshOutcome } from "../ui/RefreshButton.tsx";
import { SectionHeader } from "../ui/SectionHeader.tsx";
import { RelativeTime } from "../ui/RelativeTime.tsx";
import { FADE_OUT } from "../ui/HeightReveal.tsx";
import { Table, TableRow } from "../ui/Table.tsx";
import { api } from "../lib/api.ts";
import { EASE, SPRING, pageTransition } from "../lib/motion.ts";
import { useEscape, useNav, useRouteHeading } from "../lib/nav.ts";
import { useRefetchOnReturn } from "../lib/refetch.ts";
import "./EventsPage.css";

const FADE_IN = { duration: 0.2, ease: EASE.css } as const;

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
      <Panel className="events-panel" aria-label="Recent events">
        <SectionHeader
          className="ev-head"
          actions={<RefreshButton onRefresh={load} updatedAt={updatedAt} noun={["event", "events"]} disabled={!events && !error} />}
        />
        <AnimatePresence initial={false}>
          {(events || error) && (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={FADE_IN}>
              {!events ? (
                <EmptyState size="medium">Couldn't load events: {error}</EmptyState>
              ) : events.length === 0 ? (
                <>
                  <EmptyState size="medium">No Plex events yet</EmptyState>
                  <Table className="ev-list" />
                </>
              ) : (
                <Table
                  className="ev-list"
                  headClassName="ev-cols"
                  head={
                    <>
                      <span>Time</span>
                      <span>Event</span>
                      <span>User</span>
                      <span>Title</span>
                      <span>Library</span>
                      <span>Sent to</span>
                    </>
                  }
                >
                  <AnimatePresence initial={false}>
                    {events.map((e) => (
                      <EventRow key={e.id} e={e} fresh={!initialIds.current?.has(e.id)} />
                    ))}
                  </AnimatePresence>
                </Table>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </Panel>
    </motion.div>
  );
}

function EventRow({ e, fresh }: { e: IncomingEvent; fresh: boolean }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const vars = useMemo(() => templateVars(e.payload), [e.payload]);
  const sent = e.routing.filter((r) => r.status === "sent" || r.status === "grouped").map((r) => r.name);
  const held = e.routing.some((r) => r.status === "held");

  return (
    <TableRow
      className="ev-row"
      summaryClassName="ev-summary"
      detailClassName="ev-detail"
      open={open}
      onToggle={() => setOpen((o) => !o)}
      detailId={`event-${e.id}-detail`}
      fresh={fresh}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: FADE_OUT }}
      transition={{ ...SPRING.page, layout: SPRING.morph }}
      summary={
        <>
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
        </>
      }
      detail={<EventDetail e={e} />}
    />
  );
}

function EventDetail({ e }: { e: IncomingEvent }) {
  return (
    <>
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
      <CodeBlock label="Payload">{JSON.stringify(e.payload, null, 2)}</CodeBlock>
    </>
  );
}

const text = (v: unknown): string => (v === undefined || v === null ? "" : String(v));

const MARKS: Record<RouteStatus, { mark: string; className: string }> = {
  sent: { mark: "✓", className: "ok" },
  grouped: { mark: "✓", className: "ok" },
  held: { mark: "◷", className: "pending" },
  skipped: { mark: "✗", className: "skipped" },
};
