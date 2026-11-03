import { Fragment, createElement, useState } from "react";
import { Popover, type PopoverProps } from "../../public/ui/Popover.tsx";
import type { Fixture } from "../fixture.ts";

function PopoverDemo({ anchor: _anchor, ...props }: PopoverProps) {
  const [el, setEl] = useState<HTMLButtonElement | null>(null);
  return createElement(
    Fragment,
    null,
    createElement("button", { type: "button", ref: setEl }, "Anchor"),
    createElement(Popover, { ...props, anchor: el }, createElement("button", { type: "button" }, "First option"), createElement("button", { type: "button" }, "Second option")),
  );
}

export default {
  component: PopoverDemo,
  props: { id: "demo-popover", open: true, label: "Pick one" },
  bind: { onClose: () => ({ open: false }) },
} satisfies Fixture;
