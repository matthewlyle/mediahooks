import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Delivery, DeliveryDetail, Webhook } from "../../src/types.ts";
import { Button, LinkButton } from "../ui/Button.tsx";
import { PausedBadge } from "../ui/PausedBadge.tsx";
import { RefreshButton, type RefreshOutcome } from "../ui/RefreshButton.tsx";
import { RelativeTime } from "../ui/RelativeTime.tsx";
import { Table, TableRow, useHeight } from "../ui/Table.tsx";
import { Sentence } from "../ui/Sentence.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { Switch } from "../ui/Switch.tsx";
import { useToast } from "../ui/Toast.tsx";
import { api } from "../lib/api.ts";
import { EASE, SPRING, fadeIn, flash, ids, pageTransition } from "../lib/motion.ts";
import { useEscape, useNav, useRouteHeading } from "../lib/nav.ts";
import { useRefetchOnReturn } from "../lib/refetch.ts";
import { eventWords, webhookParts } from "../lib/sentence.ts";
import { useStore } from "../lib/store.tsx";
import "./DetailPage.css";

export function DetailPage({ id }: { id: number }) {
  const navigate = useNav();
  const present = useIsPresent();
  const { webhooks, loaded } = useStore();
  const found = webhooks.find((x) => x.id === id);
  const last = useRef(found);
  if (found) last.current = found;
  const w = found ?? (present ? undefined : last.current);
  const [direct] = useState(() => !loaded);
  const deliveries = useDeliveries(id);

  useEscape(() => navigate("/", { instant: true }));

  return (
    <motion.div className="page page-detail" {...pageTransition}>
      <motion.div className="detail-nav" {...fadeIn}>
        <LinkButton to="/">Back</LinkButton>
      </motion.div>
      {w ? (
        <>
          <Head w={w} direct={direct} />
          <Deliveries {...deliveries} />
        </>
      ) : (
        loaded && (
          <motion.p className="panel muted detail-missing" {...fadeIn}>
            No such webhook
          </motion.p>
        )
      )}
    </motion.div>
  );
}

type Log = { items: Delivery[]; fresh: ReadonlySet<number> };

type DeliveriesState = {
  log: Log | null;
  failed: boolean;
  updatedAt: number | null;
  refresh(): Promise<RefreshOutcome>;
};

function useDeliveries(id: number): DeliveriesState {
  const { setLastDelivery } = useStore();
  const [log, setLog] = useState<Log | null>(null);
  const [failed, setFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const shown = useRef<Set<number> | null>(null);

  const refresh = useCallback(async (): Promise<RefreshOutcome> => {
    const res = await api<Delivery[]>(`/api/webhooks/${id}/deliveries`);
    if (!res.ok) return { ok: false, error: res.error };
    const items = res.data;
    const seen = shown.current;
    const fresh = new Set(seen ? items.filter((d) => !seen.has(d.id)).map((d) => d.id) : []);
    shown.current = new Set(items.map((d) => d.id));
    setLog({ items, fresh });
    setUpdatedAt(Date.now());
    setLastDelivery(id, items[0] ?? null);
    return { ok: true, added: fresh.size };
  }, [id, setLastDelivery]);

  useEffect(() => {
    void refresh().then((r) => setFailed(!r.ok));
  }, [refresh]);
  useRefetchOnReturn(refresh);

  return { log, failed, updatedAt, refresh };
}

type HeadProps = { w: Webhook; direct: boolean };

const cleanError = (error: string | null) => (error ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

function Head({ w, direct }: HeadProps) {
  const heading = useRouteHeading<HTMLHeadingElement>();
  const store = useStore();
  const toast = useToast();
  const navigate = useNav();
  const panel = useRef<HTMLElement>(null);
  const last = store.lastDelivery[w.id];
  const failure = last && !last.ok ? cleanError(last.error) : "";
  const toggling = useRef(false);

  async function onToggle(enabled: boolean) {
    if (toggling.current) return;
    toggling.current = true;
    store.upsert({ ...w, enabled });
    const res = await api<Webhook>(`/api/webhooks/${w.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...w, enabled }),
    });
    toggling.current = false;
    if (res.ok) {
      store.upsert(res.data);
      return;
    }
    store.upsert(w);
    toast.show(`Couldn't ${enabled ? "resume" : "pause"} ${w.name}: ${res.error}`, { sticky: true });
    flash(panel.current, "error");
  }

  function onDelete() {
    const index = store.webhooks.findIndex((x) => x.id === w.id);
    const nextId = store.webhooks[index + 1]?.id;
    store.remove(w.id);
    navigate("/");
    requestAnimationFrame(() => {
      const next = nextId === undefined ? null : document.querySelector<HTMLElement>(`[data-id="${nextId}"] .card-main`);
      (next ?? document.getElementById("new-hook"))?.focus({ preventScroll: true });
    });
    toast.show(`Deleted ${w.name}`, {
      subject: w.name,
      undo: () => {
        store.restore(w, index);
        store.setHighlight({ id: w.id, tone: "accent", focus: true });
      },
      onCommit: async () => {
        const res = await api<void>(`/api/webhooks/${w.id}`, { method: "DELETE", keepalive: true });
        if (res.ok || res.status === 404) return;
        store.restore(w, index);
        store.setHighlight({ id: w.id, tone: "error" });
        toast.show(`Couldn't delete ${w.name}`);
      },
    });
  }

  return (
    <motion.section
      ref={panel}
      layoutId={ids.card(w.id)}
      layoutCrossfade={false}
      className={w.enabled ? "panel detail-head" : "panel detail-head disabled"}
      style={{ borderRadius: 2 }}
      initial={direct ? { opacity: 0 } : undefined}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: EASE.css, layout: SPRING.morph }}
    >
      <div className="detail-main">
        <div className="detail-title">
          <motion.h2
            ref={heading}
            tabIndex={-1}
            layoutId={ids.name(w.id)}
            layoutCrossfade={false}
            className="detail-name"
            transition={{ layout: SPRING.morph }}
          >
            {w.name}
          </motion.h2>
          <PausedBadge paused={!w.enabled} />
        </div>
        <motion.div
          layoutId={ids.url(w.id)}
          layoutCrossfade={false}
          className="detail-url"
          transition={{ layout: SPRING.morph }}
        >
          {w.url}
        </motion.div>
        <motion.div {...fadeIn}>
          <Sentence parts={webhookParts(w)} className="detail-sentence" highlight />
        </motion.div>
        {failure && (
          <motion.p className="detail-error" {...fadeIn}>
            <span className="sr-only">Last delivery error: </span>
            {failure}
          </motion.p>
        )}
      </div>
      <motion.div className="detail-actions" {...fadeIn}>
        <StatusBadge delivery={store.lastDelivery[w.id] ?? null} />
        <Switch checked={w.enabled} onChange={onToggle} label={`${w.enabled ? "Disable" : "Enable"} ${w.name}`} />
        <LinkButton to={`/webhooks/${w.id}/edit?from=detail`}>Edit</LinkButton>
        <Button variant="danger" onClick={onDelete}>
          Delete
        </Button>
      </motion.div>
    </motion.section>
  );
}

function Deliveries({ log, failed, updatedAt, refresh }: DeliveriesState) {
  const reduce = useReducedMotion();
  const panel = useRef<HTMLElement>(null);

  const [inner, height] = useHeight<HTMLDivElement>();
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!log || settled) return;
    const frame = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(frame);
  }, [log, settled]);

  return (
    <motion.section ref={panel} className="panel deliveries" aria-labelledby="deliveries-heading" {...fadeIn}>
      <motion.div
        className="deliveries-size"
        initial={false}
        animate={{ height: height ?? "auto" }}
        transition={settled && !reduce ? SPRING.morph : { duration: 0 }}
      >
        <div ref={inner} className="deliveries-inner">
          <div className="deliveries-head">
            <h3 id="deliveries-heading">Deliveries</h3>
            <RefreshButton onRefresh={refresh} updatedAt={updatedAt} noun={["delivery", "deliveries"]} disabled={!log} />
          </div>
          {log ? (
            <Table className="deliveries-list">
              {/* Outside AnimatePresence: it must leave in the same render the first row arrives. */}
              {log.items.length === 0 && <li className="deliveries-empty">No deliveries yet</li>}
              <AnimatePresence initial={false}>
                {log.items.map((d) => (
                  <DeliveryRow key={d.id} d={d} fresh={log.fresh.has(d.id)} />
                ))}
              </AnimatePresence>
            </Table>
          ) : (
            failed && <p className="muted">Could not load deliveries</p>
          )}
        </div>
      </motion.div>
    </motion.section>
  );
}

function DeliveryRow({ d, fresh }: { d: Delivery; fresh: boolean }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const error = cleanError(d.error);
  const detail = d.ok || !error ? `${d.durationMs} ms` : error;
  const retries = d.attempts - 1;

  return (
    <TableRow
      className="d-row"
      summaryClassName="d-summary"
      detailClassName="d-detail"
      open={open}
      onToggle={() => setOpen((o) => !o)}
      detailId={`delivery-${d.id}-detail`}
      fresh={fresh}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.1, ease: EASE.css } }}
      transition={{ duration: 0.25, ease: EASE.outQuint, layout: SPRING.morph }}
      summary={
        <>
          <span className={`result ${d.ok ? "ok" : "fail"}`}>
            <span className="sr-only">{d.ok ? "Delivered" : "Failed"}: </span>
            {d.status ?? "ERR"} · {detail}
          </span>
          <span className="d-what">
            <span className="d-event">{eventWords(d.event)}</span>
            {retries > 0 && <span className="d-retries">after {retries === 1 ? "1 retry" : `${retries} retries`}</span>}
          </span>
          <span className="d-time">
            <RelativeTime ms={d.createdAt} />
          </span>
        </>
      }
      detail={<DeliveryExchange d={d} />}
    />
  );
}

function DeliveryExchange({ d }: { d: Delivery }) {
  const [detail, setDetail] = useState<DeliveryDetail | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    void api<DeliveryDetail>(`/api/deliveries/${d.id}`).then((res) => (res.ok ? setDetail(res.data) : setFailed(res.error)));
  }, [d.id]);

  return failed !== null ? (
    <p className="muted">Couldn't load this delivery: {failed}</p>
  ) : detail === null ? null : detail.request === null ? (
    <p className="muted">{detail.error ?? "Not recorded"}</p>
  ) : (
    <>
      <span className="label">Request</span>
      <pre className="d-message mono">
        <span className="d-message-head">{`POST ${detail.request.url}\n${headerLines(detail.request.headers)}\n\n`}</span>
        {detail.request.body}
        {detail.request.truncated && <span className="muted">{"\n… cut at 8 KB"}</span>}
      </pre>
      <span className="label">Response</span>
      {detail.response === null ? (
        <p className="muted">No response: {detail.error}</p>
      ) : (
        <pre className="d-message mono">
          <span className="d-message-head">{`HTTP ${detail.status}\n${headerLines(detail.response.headers)}\n\n`}</span>
          {detail.response.body}
          {detail.response.truncated && <span className="muted">{"\n… cut at 8 KB"}</span>}
        </pre>
      )}
    </>
  );
}

const headerLines = (headers: Record<string, string>) =>
  Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
