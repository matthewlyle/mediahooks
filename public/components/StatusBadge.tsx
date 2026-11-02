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
          title={delivery.error ?? undefined}
          initial={reduce ? { opacity: 0 } : delivery.ok ? { opacity: 0, scale: 0.9 } : { opacity: 0, y: -2 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0 } }}
          transition={delivery.ok && !reduce ? SPRING.pop : { duration: 0.2, ease: EASE.outQuint }}
        >
          {delivery.status ?? "ERR"} · <RelativeTime ms={delivery.createdAt} />
        </motion.span>
      )}
    </AnimatePresence>
  );
}
