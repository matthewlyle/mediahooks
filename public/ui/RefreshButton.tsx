import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { EASE } from "../lib/motion.ts";
import { Button } from "./Button.tsx";
import { RelativeTime } from "./RelativeTime.tsx";
import "./RefreshButton.css";

/** Result of a refresh: how many new items arrived, or the error message. */
export type RefreshOutcome = { ok: true; added: number } | { ok: false; error: string };

type Status = { kind: "idle" } | { kind: "busy" } | { kind: "result"; outcome: RefreshOutcome; n: number };

const RESULT_MS = 1600;
const MIN_BUSY_MS = 450;

const MORPH = {
  initial: { opacity: 0, y: 3, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.25, ease: EASE.outQuint } },
  exit: { opacity: 0, y: -3, filter: "blur(4px)", transition: { duration: 0.15, ease: EASE.css } },
} as const;

function Check() {
  const reduce = useReducedMotion();
  return (
    <svg className="refresh-check" viewBox="0 0 10 10" aria-hidden="true">
      <motion.path
        d="M1.5 5.5 L4 8 L8.5 2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.18, duration: 0.3, ease: EASE.outQuint }}
      />
    </svg>
  );
}

function delay(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

export type RefreshButtonProps = {
  /** Runs the refresh and resolves with its outcome. */
  onRefresh: () => Promise<RefreshOutcome>;
  /** Epoch milliseconds of the last successful load, or null to hide the status. */
  updatedAt: number | null;
  /** Singular and plural name of the refreshed items, used in the "N new" result. */
  noun: [string, string];
  /** Disables the button. */
  disabled?: boolean;
};

/** A refresh button with a status line that shows the last update time, then the outcome of each refresh. */
export function RefreshButton({ onRefresh, updatedAt, noun, disabled }: RefreshButtonProps) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const n = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function onClick() {
    clearTimeout(timer.current);
    setStatus({ kind: "busy" });
    const [outcome] = await Promise.all([onRefresh(), delay(MIN_BUSY_MS)]);
    setStatus({ kind: "result", outcome, n: ++n.current });
    timer.current = setTimeout(() => setStatus({ kind: "idle" }), RESULT_MS);
  }

  const busy = status.kind === "busy";
  let key = "updated";
  let tone = "muted";
  let label: ReactNode =
    updatedAt === null ? null : (
      <>
        Updated <RelativeTime ms={updatedAt} />
      </>
    );
  if (status.kind === "result") {
    const { outcome } = status;
    key = `result-${status.n}`;
    if (!outcome.ok) {
      label = <span title={outcome.error}>Couldn't refresh</span>;
      tone = "fail";
    } else if (outcome.added === 0) {
      label = (
        <>
          <Check />
          Up to date
        </>
      );
    } else {
      label = `${outcome.added} new ${outcome.added === 1 ? noun[0] : noun[1]}`;
      tone = "new";
    }
  }

  return (
    <div className="refresh">
      <span className="refresh-status" role="status" aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false}>
          {label !== null && (
            <motion.span key={key} className={`refresh-label ${tone}`} {...MORPH}>
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <Button className="refresh-btn" onClick={() => void onClick()} disabled={disabled} busy={busy} spinner={false}>
        <svg className={busy ? "refresh-icon spinning" : "refresh-icon"} viewBox="0 0 16 16" aria-hidden="true">
          <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path
            d="M13.6 2.2v3h-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Refresh
      </Button>
    </div>
  );
}
