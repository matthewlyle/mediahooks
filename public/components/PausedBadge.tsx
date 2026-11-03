import { AnimatePresence } from "motion/react";
import { EASE } from "../lib/motion.ts";
import { Badge } from "../ui/Badge.tsx";

export function PausedBadge({ paused }: { paused: boolean }) {
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
