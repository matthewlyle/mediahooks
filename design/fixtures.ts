import type { ComponentType } from "react";
import { Button, LinkButton } from "../public/ui/Button.tsx";
import { Switch } from "../public/ui/Switch.tsx";

export type Fixture = {
  component: ComponentType<any>;
  props?: Record<string, unknown>;
  /** Maps a callback prop to the prop it should update with its first argument, or a function that returns the prop updates. */
  bind?: Record<string, string | ((...args: any[]) => Record<string, unknown>)>;
};

export const fixtures: Record<string, Fixture> = {
  Button: { component: Button, props: { children: "Save" } },
  LinkButton: { component: LinkButton, props: { to: "/", children: "Back" } },
  Switch: { component: Switch, props: { checked: false, label: "Enabled" }, bind: { onChange: "checked" } },
};
