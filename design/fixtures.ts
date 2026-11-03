import { createElement, type ComponentType, type ReactNode } from "react";
import { Button, LinkButton } from "../public/ui/Button.tsx";
import { Segmented } from "../public/ui/Segmented.tsx";
import { Switch } from "../public/ui/Switch.tsx";
import { ToastProvider, useToast } from "../public/ui/Toast.tsx";

function ToastDemo({ children }: { children?: ReactNode }) {
  const toast = useToast();
  return createElement(Button, { onClick: () => toast.show(String(children ?? "")) }, "Show toast");
}

function ToastPreview({ children }: { children?: ReactNode }) {
  return createElement(ToastProvider, null, createElement(ToastDemo, null, children));
}

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
  ToastProvider: { component: ToastPreview, props: { children: "Saved" } },
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
