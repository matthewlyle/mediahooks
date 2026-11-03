import { AnimatePresence, useReducedMotion } from "motion/react";
import type { ReactElement } from "react";
import type { Delivery } from "../../src/types.ts";
import { EASE, SPRING } from "../lib/motion.ts";
import { Badge } from "./Badge.tsx";
import { RelativeTime } from "./RelativeTime.tsx";
import "./StatusBadge.css";

type Status = "success" | "failure" | "pending";

const MARKS: Record<Status, ReactElement> = {
  success: <path d="M1.5 5.5 L4 8 L8.5 2" />,
  failure: <path d="M2 2 L8 8 M8 2 L2 8" />,
  pending: (
    <>
      <circle cx="5" cy="5" r="3.8" />
      <path d="M5 2.8 V5 L6.6 6" />
    </>
  ),
};

/** A small decorative icon for an outcome: a check for success, a cross for failure, a clock for pending. */
export function StatusMark({ status, className }: {
  /** Which outcome to draw; it also sets the color to green, red or the accent. */
  status: Status;
  /** Extra class names for the icon. */
  className?: string;
}) {
  return (
    <svg
      className={["status-mark", `status-mark-${status}`, className].filter(Boolean).join(" ")}
      viewBox="0 0 10 10"
      aria-hidden="true"
    >
      {MARKS[status]}
    </svg>
  );
}

/** A badge showing the result of a webhook's last delivery: its mark, HTTP status and how long ago it ran. Renders nothing without one. */
export function StatusBadge({ delivery }: {
  /** The last delivery to summarize, or null if the webhook hasn't delivered yet. */
  delivery: Delivery | null;
}) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false} mode="popLayout">
      {delivery && (
        <Badge
          key={delivery.id}
          tone={delivery.ok ? "success" : "error"}
          initial={reduce ? { opacity: 0 } : delivery.ok ? { opacity: 0, scale: 0.9 } : { opacity: 0, y: -2 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0 } }}
          transition={delivery.ok && !reduce ? SPRING.pop : { duration: 0.2, ease: EASE.outQuint }}
        >
          <StatusMark status={delivery.ok ? "success" : "failure"} className="status-mark-inline" />
          <span className="sr-only">{delivery.ok ? "Delivered" : "Failed"}: </span>
          {delivery.status ?? "ERR"} · <RelativeTime ms={delivery.createdAt} />
        </Badge>
      )}
    </AnimatePresence>
  );
}
