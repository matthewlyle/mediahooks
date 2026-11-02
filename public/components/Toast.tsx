import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EASE } from "../lib/motion.ts";
import { Button } from "./Button.tsx";

export type ToastOptions = {
  undo?: () => void;
  onCommit?: () => void;
};
export type Toaster = { show(text: string, opts?: ToastOptions): void };

const UNDO_MS = 5000;
const TOAST_MS = 4000;

type Pending = ToastOptions & { remaining: number; startedAt: number; timer: ReturnType<typeof setTimeout> | undefined };

const ToastContext = createContext<Toaster | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const [toast, setToast] = useState<{ text: string; undo: boolean } | null>(null);
  const pending = useRef<Pending | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const node = useRef<HTMLDivElement>(null);

  const commit = useCallback((p: Pending) => {
    clearTimeout(p.timer);
    if (pending.current === p) {
      pending.current = null;
      setToast(null);
    }
    p.onCommit?.();
  }, []);

  const resume = useCallback(() => {
    const p = pending.current;
    if (!p || p.timer !== undefined) return;
    const el = node.current;
    if (el && (el.matches(":hover") || el.contains(document.activeElement))) return;
    p.startedAt = Date.now();
    p.timer = setTimeout(() => commit(p), p.remaining);
  }, [commit]);

  const pause = useCallback(() => {
    const p = pending.current;
    if (!p || p.timer === undefined) return;
    clearTimeout(p.timer);
    p.timer = undefined;
    p.remaining -= Date.now() - p.startedAt;
  }, []);

  const show = useCallback(
    (text: string, opts: ToastOptions = {}) => {
      clearTimeout(hideTimer.current);
      const previous = pending.current;
      pending.current = null;
      if (previous) commit(previous);
      setToast({ text, undo: Boolean(opts.undo) });
      if (opts.undo) {
        pending.current = { ...opts, remaining: UNDO_MS, startedAt: 0, timer: undefined };
        resume();
      } else {
        hideTimer.current = setTimeout(() => setToast(null), TOAST_MS);
      }
    },
    [commit, resume],
  );

  function onUndo() {
    const p = pending.current;
    if (!p) return;
    clearTimeout(p.timer);
    pending.current = null;
    setToast(null);
    p.undo?.();
  }

  useEffect(() => {
    const onPageHide = () => {
      const p = pending.current;
      if (!p) return;
      clearTimeout(p.timer);
      pending.current = null;
      p.onCommit?.();
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
          {toast && (
            <motion.div
              key="toast"
              ref={node}
              className="toast"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: EASE.outQuint } }}
              exit={reduce ? { opacity: 0, transition: { duration: 0.15, ease: EASE.css } } : { opacity: 0, y: 8, transition: { duration: 0.15, ease: EASE.outQuint } }}
              onPointerEnter={pause}
              onFocus={pause}
              onPointerLeave={resume}
              onBlur={() => requestAnimationFrame(resume)} // after focus settles
            >
              <span className="toast-text">{toast.text}</span>
              {toast.undo && (
                <Button className="toast-undo" onClick={onUndo}>
                  Undo
                </Button>
              )}
            </motion.div>
          )}
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
