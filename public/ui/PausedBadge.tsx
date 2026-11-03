import { AnimatePresence } from "motion/react";
import { EASE } from "../lib/motion.ts";
import { Badge } from "./Badge.tsx";

/** A "Paused" badge that fades in and out as its `paused` flag turns on and off. */
export function PausedBadge({ paused }: {
  /** Whether to show the badge. False removes it with a fade. */
  paused: boolean;
}) {
  return (
    <AnimatePresence initial={false}>
      {paused && (
        <Badge
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.2, ease: EASE.css } }}
          exit={{ opacity: 0, transition: { duration: 0.15, ease: EASE.css } }}
        >
          Paused
        </Badge>
      )}
    </AnimatePresence>
  );
}
