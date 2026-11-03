import { StatusBadge } from "../../public/ui/StatusBadge.tsx";
import type { Fixture } from "../fixture.ts";

export default {
  component: StatusBadge,
  props: { delivery: { id: 1, webhookId: 1, event: "media.play", status: 200, ok: true, error: null, durationMs: 120, attempts: 1, createdAt: Date.now() - 3 * 60_000 } },
} satisfies Fixture;
