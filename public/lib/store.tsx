import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Delivery, Webhook, WebhookListItem } from "../../src/types.ts";
import { api, type Meta, type PlexStatus } from "./api.ts";
import { useRefetchOnReturn } from "./refetch.ts";

export type Highlight = { id: number; tone: "accent" | "error"; focus?: boolean };

export type Store = {
  meta: Meta | null;
  webhooks: Webhook[];
  lastDelivery: Record<number, Delivery | null>;
  status: PlexStatus | null;
  loaded: boolean;
  error: string | null;
  highlight: Highlight | null;
  refresh(): Promise<void>;
  refreshStatus(): Promise<void>;
  upsert(w: Webhook): void;
  remove(id: number): void;
  restore(w: Webhook, index: number): void;
  setLastDelivery(id: number, d: Delivery | null): void;
  setHighlight(h: Highlight | null): void;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [lastDelivery, setLastDeliveries] = useState<Record<number, Delivery | null>>({});
  const [status, setStatus] = useState<PlexStatus | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  // Removed here but not yet on the server (the Undo window): a refetch mustn't bring them back.
  const pendingRemoval = useRef(new Set<number>());

  const refreshStatus = useCallback(async () => {
    const res = await api<PlexStatus>("/api/status");
    setStatus(res.ok ? res.data : null);
  }, []);

  const refresh = useCallback(async () => {
    void refreshStatus();
    const [m, list] = await Promise.all([api<Meta>("/api/meta"), api<WebhookListItem[]>("/api/webhooks")]);
    if (!m.ok) return setError(m.error);
    if (!list.ok) return setError(list.error);
    const last: Record<number, Delivery | null> = {};
    const serverIds = new Set(list.data.map((w) => w.id));
    for (const id of pendingRemoval.current) if (!serverIds.has(id)) pendingRemoval.current.delete(id);
    const hooks = list.data
      .filter((w) => !pendingRemoval.current.has(w.id))
      .map(({ lastDelivery: d, ...w }) => {
        last[w.id] = d;
        return w;
      });
    setMeta(m.data);
    setWebhooks(hooks);
    setLastDeliveries(last);
    setError(null);
    setLoaded(true);
  }, [refreshStatus]);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  useRefetchOnReturn(refresh);

  const upsert = useCallback((w: Webhook) => {
    pendingRemoval.current.delete(w.id);
    setWebhooks((list) => {
      const i = list.findIndex((x) => x.id === w.id);
      if (i === -1) return [...list, w];
      const next = list.slice();
      next[i] = w;
      return next;
    });
  }, []);

  const remove = useCallback((id: number) => {
    pendingRemoval.current.add(id);
    setWebhooks((list) => list.filter((x) => x.id !== id));
  }, []);

  const restore = useCallback((w: Webhook, index: number) => {
    pendingRemoval.current.delete(w.id);
    setWebhooks((list) => {
      const next = list.filter((x) => x.id !== w.id);
      next.splice(Math.max(0, Math.min(index, next.length)), 0, w);
      return next;
    });
  }, []);

  const setLastDelivery = useCallback((id: number, d: Delivery | null) => {
    setLastDeliveries((all) => ({ ...all, [id]: d }));
  }, []);

  const value = useMemo<Store>(
    () => ({
      meta,
      webhooks,
      lastDelivery,
      status,
      loaded,
      error,
      highlight,
      refresh,
      refreshStatus,
      upsert,
      remove,
      restore,
      setLastDelivery,
      setHighlight,
    }),
    [meta, webhooks, lastDelivery, status, loaded, error, highlight, refresh, refreshStatus, upsert, remove, restore, setLastDelivery],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore outside <StoreProvider>");
  return store;
}

export function usePlexStatus(): PlexStatus | null {
  const { status, loaded, refreshStatus } = useStore();
  const [stale] = useState(loaded);
  useEffect(() => {
    if (stale) void refreshStatus();
  }, [stale, refreshStatus]);
  return status;
}
