import { Fragment, createElement, useState, type ComponentType } from "react";
import { Button, LinkButton } from "../public/ui/Button.tsx";
import { Popover, type PopoverProps } from "../public/ui/Popover.tsx";

export type Fixture = {
  component: ComponentType<any>;
  props?: Record<string, unknown>;
  /** Maps a callback prop to the prop it should update with its first argument, or a function that returns the prop updates. */
  bind?: Record<string, string | ((...args: any[]) => Record<string, unknown>)>;
};

export const fixtures: Record<string, Fixture> = {
  Button: { component: Button, props: { children: "Save" } },
  LinkButton: { component: LinkButton, props: { to: "/", children: "Back" } },
};

function PopoverDemo({ anchor: _anchor, ...props }: PopoverProps) {
  const [el, setEl] = useState<HTMLButtonElement | null>(null);
  return createElement(
    Fragment,
    null,
    createElement("button", { type: "button", ref: setEl }, "Anchor"),
    createElement(Popover, { ...props, anchor: el }, createElement("button", { type: "button" }, "First option"), createElement("button", { type: "button" }, "Second option")),
  );
}

fixtures.Popover = {
  component: PopoverDemo,
  props: { id: "demo-popover", open: true, label: "Pick one" },
  bind: { onClose: () => ({ open: false }) },
};
