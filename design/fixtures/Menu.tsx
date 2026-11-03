import { Menu } from "../../public/ui/Menu.tsx";
import type { Fixture } from "../fixture.ts";

export default {
  component: Menu,
  group: "Actions",
  props: {
    label: "Actions",
    children: "Actions",
    overflow: false,
    heading: "Webhook",
    items: [
      { label: "Edit", onSelect: () => {} },
      { label: "Duplicate", onSelect: () => {}, disabled: true },
      { label: "Delete", onSelect: () => {}, danger: true },
    ],
  },
} satisfies Fixture;
