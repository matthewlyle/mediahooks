import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Delivery } from "../../src/types.ts";
import { EASE, SPRING } from "../lib/motion.ts";
import { RelativeTime } from "./RelativeTime.tsx";

export function StatusBadge({ delivery }: { delivery: Delivery | null }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false} mode="popLayout">
      {delivery && (
        <motion.span
          key={delivery.id}
          className={`result ${delivery.ok ? "ok" : "fail"}`}
          initial={reduce ? { opacity: 0 } : delivery.ok ? { opacity: 0, scale: 0.9 } : { opacity: 0, y: -2 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0 } }}
          transition={delivery.ok && !reduce ? SPRING.pop : { duration: 0.2, ease: EASE.outQuint }}
        >
          <svg className="result-mark" viewBox="0 0 10 10" aria-hidden="true">
            <path
              d={delivery.ok ? "M1.5 5.5 L4 8 L8.5 2" : "M2 2 L8 8 M8 2 L2 8"}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="sr-only">{delivery.ok ? "Delivered" : "Failed"}: </span>
          {delivery.status ?? "ERR"} · <RelativeTime ms={delivery.createdAt} />
        </motion.span>
      )}
    </AnimatePresence>
  );
}
