import type { ComponentType } from "react";
import { Button, LinkButton } from "../public/ui/Button.tsx";
import { Segmented } from "../public/ui/Segmented.tsx";
import { Spinner } from "../public/ui/Spinner.tsx";

export type Fixture = {
  component: ComponentType<any>;
  props?: Record<string, unknown>;
  /** Maps a callback prop to the prop it should update with its first argument, or a function that returns the prop updates. */
  bind?: Record<string, string | ((...args: any[]) => Record<string, unknown>)>;
};

export const fixtures: Record<string, Fixture> = {
  Button: { component: Button, props: { children: "Save" } },
  LinkButton: { component: LinkButton, props: { to: "/", children: "Back" } },
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
  Spinner: { component: Spinner, props: { inverse: false } },
};
