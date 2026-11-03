import { RefreshButton } from "../../public/ui/RefreshButton.tsx";
import type { Fixture } from "../fixture.ts";

export default {
  component: RefreshButton,
  props: { updatedAt: Date.now() - 60_000, noun: ["event", "events"] },
  returns: { onRefresh: async () => ({ ok: true as const, added: 2 }) },
} satisfies Fixture;
