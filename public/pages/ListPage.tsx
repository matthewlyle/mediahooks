import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { SendResult } from "../../src/send.ts";
import type { Delivery, Webhook } from "../../src/types.ts";
import { EmptyState } from "../ui/EmptyState.tsx";
import { burst } from "../components/burst.ts";
import { Menu } from "../ui/Menu.tsx";
import { PausedBadge } from "../ui/PausedBadge.tsx";
import { Sentence } from "../ui/Sentence.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { Switch } from "../ui/Switch.tsx";
import { useToast } from "../ui/Toast.tsx";
import { api } from "../lib/api.ts";
import { EASE, SPRING, flash, ids, pageTransition } from "../lib/motion.ts";
import { useLinkProps, useNav, useRouteHeading } from "../lib/nav.ts";
import { webhookParts } from "../lib/sentence.ts";
import { useStore } from "../lib/store.tsx";

type Enter = "stagger" | "pop";

export function ListPage() {
  const heading = useRouteHeading<HTMLHeadingElement>();
  const { webhooks, lastDelivery, loaded, error } = useStore();
  const reduce = useReducedMotion();
  const firstLoad = useRef(!loaded);
  useEffect(() => {
    if (loaded) firstLoad.current = false;
  }, [loaded]);
  const enter: Enter = firstLoad.current ? "stagger" : "pop";

  return (
    <motion.div className="page page-list" {...pageTransition}>
      <h2 ref={heading} tabIndex={-1} className="sr-only">Webhooks</h2>
      {error && !loaded ? (
        <EmptyState>Could not reach the mediahooks API.</EmptyState>
      ) : (
        <>
          <ul className="hooks">
            <AnimatePresence mode="popLayout" initial={false}>
              {webhooks.map((w, index) => (
                <Row key={w.id} w={w} last={lastDelivery[w.id] ?? null} index={index} enter={enter} />
              ))}
              {loaded && webhooks.length === 0 && (
                <EmptyState
                  as="li"
                  key="empty"
                  layout
                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.1, ease: EASE.css } }}
                  transition={{ ...SPRING.pop, layout: SPRING.morph }}
                >
                  No webhooks
                </EmptyState>
              )}
            </AnimatePresence>
          </ul>
        </>
      )}
    </motion.div>
  );
}

type RowProps = { w: Webhook; last: Delivery | null; index: number; enter: Enter };

function Row({ w, last, index, enter }: RowProps) {
  const store = useStore();
  const toast = useToast();
  const navigate = useNav();
  const reduce = useReducedMotion();
  const row = useRef<HTMLLIElement>(null);
  const toggling = useRef(false);
  const [arrival] = useState(() => ({ enter, delay: 0.1 + Math.min(index, 10) * 0.05 }));

  const { highlight, setHighlight } = store;
  useEffect(() => {
    if (highlight?.id !== w.id) return;
    setHighlight(null);
    flash(row.current, highlight.tone);
    if (highlight.focus) row.current?.querySelector<HTMLElement>(".card-main")?.focus({ preventScroll: true });
  }, [highlight, setHighlight, w.id]);

  const link = useLinkProps(`/webhooks/${w.id}`);

  function rowLink(event: MouseEvent<HTMLLIElement>): HTMLAnchorElement | null {
    const target = event.target as Element;
    // Clicks inside the menu portal bubble here through React; only real descendants count.
    if (!event.currentTarget.contains(target) || target.closest("button")) return null;
    const anchor = event.currentTarget.querySelector<HTMLAnchorElement>(".card-main");
    return anchor === target ? null : anchor;
  }

  function onRowClick(event: MouseEvent<HTMLLIElement>) {
    const anchor = rowLink(event);
    if (!anchor || getSelection()?.toString()) return;
    const { metaKey, ctrlKey, shiftKey, altKey } = event;
    if (metaKey || ctrlKey || shiftKey || altKey) {
      anchor.dispatchEvent(new MouseEvent("click", { cancelable: true, view: window, metaKey, ctrlKey, shiftKey, altKey }));
      return;
    }
    link.onClick(event);
  }

  function onRowAuxClick(event: MouseEvent<HTMLLIElement>) {
    const anchor = rowLink(event);
    if (!anchor || event.button !== 1) return;
    const mac = /Mac|iPhone|iPad/.test(navigator.userAgent);
    anchor.dispatchEvent(new MouseEvent("click", { cancelable: true, view: window, metaKey: mac, ctrlKey: !mac }));
  }

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
    flash(row.current, "error");
  }

  async function onDuplicate() {
    const res = await api<Webhook>("/api/webhooks", {
      method: "POST",
      body: JSON.stringify({ ...w, name: `${w.name} copy` }),
    });
    if (!res.ok) {
      toast.show(`Couldn't duplicate ${w.name}: ${res.error}`, { sticky: true });
      flash(row.current, "error");
      return;
    }
    store.restore(res.data, index + 1);
    store.setLastDelivery(res.data.id, null);
    store.setHighlight({ id: res.data.id, tone: "accent" });
  }

  async function onSendTest() {
    const res = await api<SendResult>("/api/send-test", { method: "POST", body: JSON.stringify(w) });
    if (!res.ok) {
      toast.show(`Couldn't send a test to ${w.name}: ${res.error}`, { sticky: true });
      flash(row.current, "error");
      return;
    }
    const { ok, status, durationMs, error } = res.data;
    toast.show(ok ? `Test to ${w.name}: ${status} · ${durationMs}ms` : `Test to ${w.name} failed: ${status ?? error ?? "error"}`, { sticky: !ok });
    if (ok) burst(row.current?.querySelector<HTMLElement>(".more-btn"));
    else flash(row.current, "error");
  }

  function onDelete() {
    const nextId = store.webhooks[index + 1]?.id;
    store.remove(w.id);
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
    <motion.li
      ref={row}
      layoutId={ids.card(w.id)}
      layoutCrossfade={false}
      data-id={w.id}
      className={w.enabled ? "card" : "card disabled"}
      style={{ borderRadius: 2 }}
      initial={
        reduce
          ? { opacity: 0 }
          : arrival.enter === "stagger"
            ? { opacity: 0, y: 16, scale: 0.96 }
            : { opacity: 0, scale: 0.9 }
      }
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={
        reduce
          ? { opacity: 0, transition: { duration: 0.15, ease: EASE.css } }
          : {
              opacity: 0,
              x: -24,
              scale: 0.96,
              filter: ["blur(0px)", "blur(4px)"],
              transition: { duration: 0.2, ease: EASE.outQuint },
            }
      }
      transition={{
        ...(arrival.enter === "stagger" ? { ...SPRING.page, delay: arrival.delay } : SPRING.pop),
        layout: SPRING.morph,
      }}
      onClick={onRowClick}
      onAuxClick={onRowAuxClick}
    >
      <div className="card-text">
        <a className="card-main" aria-label={w.name} {...link} />
        <div className="card-title">
          <motion.span
            layoutId={ids.name(w.id)}
            layoutCrossfade={false}
            className="card-name"
            transition={{ layout: SPRING.morph }}
          >
            {w.name}
          </motion.span>
          <PausedBadge paused={!w.enabled} />
        </div>
        <motion.div
          layoutId={ids.url(w.id)}
          layoutCrossfade={false}
          className="card-url"
          transition={{ layout: SPRING.morph }}
        >
          {w.url}
        </motion.div>
        <Sentence parts={webhookParts(w)} className="card-summary" />
      </div>
      <div className="card-actions">
        <StatusBadge delivery={last} />
        <Switch checked={w.enabled} onChange={onToggle} label={`${w.enabled ? "Disable" : "Enable"} ${w.name}`} />
        <Menu
          label={`More actions for ${w.name}`}
          triggerClassName="more-btn"
          items={[
            { label: "Edit", onSelect: () => navigate(`/webhooks/${w.id}/edit`) },
            { label: "Test", onSelect: () => void onSendTest() },
            { label: "Deliveries", onSelect: () => navigate(link.href) },
            { label: "Duplicate", onSelect: () => void onDuplicate() },
            { label: "Delete", onSelect: onDelete, danger: true },
          ]}
        >
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </Menu>
      </div>
    </motion.li>
  );
}
