import { createElement } from "react";
import { RefreshButton, type RefreshButtonProps } from "../../public/ui/RefreshButton.tsx";
import type { Fixture } from "../fixture.ts";

function RefreshPreview({ onRefresh, ...props }: RefreshButtonProps) {
  return createElement(RefreshButton, {
    ...props,
    onRefresh: async () => {
      void onRefresh();
      return { ok: true as const, added: 2 };
    },
  });
}

export default {
  component: RefreshPreview,
  props: { updatedAt: Date.now() - 60_000, noun: ["event", "events"] },
} satisfies Fixture;
