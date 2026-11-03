import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EASE } from "../lib/motion.ts";
import { Button } from "./Button.tsx";

export type ToastOptions = { onCommit?: () => void; sticky?: boolean } & (
  | { undo?: undefined; subject?: undefined }
  | { undo: () => void; subject: string }
);
export type Toaster = { show(text: string, opts?: ToastOptions): void };

const TOAST_MS = 4000;
const FOCUS_SETTLE_MS = 500;

const ToastContext = createContext<Toaster | null>(null);
const ToastInertContext = createContext<(inert: boolean) => void>(() => { });

export function ToastProvider({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const [toasts, setToasts] = useState<{ id: number; text: string; undo: boolean; sticky: boolean; subject?: string }[]>([]);
  const [inert, setInert] = useState(false);
  const pending = useRef(new Map<number, ToastOptions>());
  const nextId = useRef(0);

  const close = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (text: string, opts: ToastOptions = {}) => {
      const id = nextId.current++;
      const add = () =>
        setToasts((list) => [...list, { id, text, undo: Boolean(opts.undo), sticky: Boolean(opts.sticky), subject: opts.subject }]);
      if (opts.sticky) setTimeout(add, FOCUS_SETTLE_MS);
      else add();
      if (opts.undo) pending.current.set(id, opts);
      else if (!opts.sticky) setTimeout(() => close(id), TOAST_MS);
    },
    [close],
  );

  function settle(id: number, run: (opts: ToastOptions) => void) {
    const opts = pending.current.get(id);
    if (!opts) return;
    pending.current.delete(id);
    close(id);
    run(opts);
  }

  useEffect(() => {
    const onPageHide = () => {
      const all = [...pending.current.values()];
      pending.current.clear();
      for (const p of all) p.onCommit?.();
    };
    addEventListener("pagehide", onPageHide);
    return () => removeEventListener("pagehide", onPageHide);
  }, []);

  const value = useMemo<Toaster>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      <ToastInertContext.Provider value={setInert}>{children}</ToastInertContext.Provider>
      <div role="status" className="toast-region" inert={inert || undefined}>
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              className="toast"
              role={t.sticky ? "alert" : undefined}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: EASE.outQuint } }}
              exit={reduce ? { opacity: 0, transition: { duration: 0.15, ease: EASE.css } } : { opacity: 0, y: 8, transition: { duration: 0.15, ease: EASE.outQuint } }}
            >
              <span className="toast-text">{t.text}</span>
              {t.sticky && (
                <Button className="toast-dismiss" aria-label={`Dismiss: ${t.text}`} onClick={() => close(t.id)}>
                  Dismiss
                </Button>
              )}
              {t.undo && (
                <>
                  <Button className="toast-undo" aria-label={`Undo deleting ${t.subject}`} onClick={() => settle(t.id, (p) => p.undo?.())}>
                    Undo
                  </Button>
                  <Button className="toast-dismiss" aria-label={`Dismiss: delete ${t.subject}`} onClick={() => settle(t.id, (p) => p.onCommit?.())}>
                    Dismiss
                  </Button>
                </>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Toaster {
  const toaster = useContext(ToastContext);
  if (!toaster) throw new Error("useToast outside <ToastProvider>");
  return toaster;
}

export function useInertToasts() {
  const setInert = useContext(ToastInertContext);
  useEffect(() => {
    setInert(true);
    return () => setInert(false);
  }, [setInert]);
}
