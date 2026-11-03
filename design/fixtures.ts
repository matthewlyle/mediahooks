import { Fragment, createElement, useState, type ComponentType } from "react";
import { Badge } from "../public/ui/Badge.tsx";
import { Button, LinkButton } from "../public/ui/Button.tsx";
import { Check } from "../public/ui/Check.tsx";
import { Modal, type ModalProps } from "../public/ui/Modal.tsx";
import { FieldError } from "../public/ui/FieldError.tsx";
import { Popover, type PopoverProps } from "../public/ui/Popover.tsx";
import { Segmented } from "../public/ui/Segmented.tsx";
import { Switch } from "../public/ui/Switch.tsx";

export type Fixture = {
  component: ComponentType<any>;
  props?: Record<string, unknown>;
  /** Maps a callback prop to the prop it should update with its first argument, or a function that returns the prop updates. */
  bind?: Record<string, string | ((...args: any[]) => Record<string, unknown>)>;
};

export const fixtures: Record<string, Fixture> = {
  Badge: { component: Badge, props: { children: "Paused" } },
  Button: { component: Button, props: { children: "Save" } },
  LinkButton: { component: LinkButton, props: { to: "/", children: "Back" } },
  Check: { component: Check, props: { checked: true, children: "Option" } },
  FieldError: { component: FieldError, props: { id: "field-error", error: "Enter a name" } },
  Switch: { component: Switch, props: { checked: false, label: "Enabled" }, bind: { onChange: "checked" } },
  Segmented: {
    component: Segmented,
    props: {
      label: "Preview with",
      options: [
        ["episode", "Episode"],
        ["movie", "Movie"],
        ["track", "Music"],
      ],
      value: "episode",
    },
    bind: { onChange: "value" },
  },
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

function ModalDemo(props: ModalProps) {
  const [open, setOpen] = useState(true);
  return createElement(
    Fragment,
    null,
    createElement("button", { type: "button", onClick: () => setOpen(true) }, "Open modal"),
    open &&
      createElement(
        Modal,
        props,
        createElement("p", null, "Dialog content"),
        createElement("button", { type: "button", onClick: () => setOpen(false) }, "Close"),
      ),
  );
}

fixtures.Modal = { component: ModalDemo, props: { label: "Example dialog" } };
