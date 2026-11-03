import { Disclosure } from "../../public/ui/Disclosure.tsx";
import type { Fixture } from "../fixture.ts";

export default {
  component: Disclosure,
  props: { label: "Headers", summary: "2 set", open: false, children: "Content that opens and closes with a height and opacity animation." },
  bind: { onOpenChange: "open" },
} satisfies Fixture;
