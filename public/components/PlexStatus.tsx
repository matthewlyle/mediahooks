import { motion } from "motion/react";
import { fadeIn } from "../lib/motion.ts";
import { usePlexStatus } from "../lib/store.tsx";
import { RelativeTime } from "../ui/RelativeTime.tsx";
import { StatusDot } from "../ui/StatusDot.tsx";

export function PlexConnection() {
  const status = usePlexStatus();
  if (!status) return null;
  return (
    <motion.p className="plex-status" {...fadeIn}>
      <StatusDot on={status.lastEventAt !== null} />
      {status.lastEventAt === null ? (
        "Waiting for the first event"
      ) : (
        <>
          Connected · last event <RelativeTime ms={status.lastEventAt} />
        </>
      )}
    </motion.p>
  );
}
