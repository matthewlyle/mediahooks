import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EASE } from "../lib/motion.ts";
import { Button } from "./Button.tsx";

export type ToastOptions = {
  undo?: () => void;
  onCommit?: () => void;
};
export type Toaster = { show(text: string, opts?: ToastOptions): void };

const TOAST_MS = 4000;

const ToastContext = createContext<Toaster | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const [toasts, setToasts] = useState<{ id: number; text: string; undo: boolean }[]>([]);
  const pending = useRef(new Map<number, ToastOptions>());
  const nextId = useRef(0);

  const close = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (text: string, opts: ToastOptions = {}) => {
      const id = nextId.current++;
      setToasts((list) => [...list, { id, text, undo: Boolean(opts.undo) }]);
      if (opts.undo) pending.current.set(id, opts);
      else setTimeout(() => close(id), TOAST_MS);
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
      {children}
      <div role="status" className="toast-region">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              className="toast"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: EASE.outQuint } }}
              exit={reduce ? { opacity: 0, transition: { duration: 0.15, ease: EASE.css } } : { opacity: 0, y: 8, transition: { duration: 0.15, ease: EASE.outQuint } }}
            >
              <span className="toast-text">{t.text}</span>
              {t.undo && (
                <>
                  <Button className="toast-undo" onClick={() => settle(t.id, (p) => p.undo?.())}>
                    Undo
                  </Button>
                  <Button className="toast-dismiss" onClick={() => settle(t.id, (p) => p.onCommit?.())}>
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
