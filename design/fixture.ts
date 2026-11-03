import type { ComponentType } from "react";

export const GROUPS = ["Actions", "Navigation", "Inputs", "Overlays", "Status", "Layout", "Data"] as const;
export type Group = (typeof GROUPS)[number];

export type Fixture = {
  component: ComponentType<any>;
  /** Sidebar section on the design site; fixtures without one are listed under Other. */
  group?: Group;
  props?: Record<string, unknown>;
  /** Maps a callback prop to the prop it should update with its first argument, or a function that returns the prop updates. */
  bind?: Record<string, string | ((...args: any[]) => Record<string, unknown>)>;
  /** Maps a callback prop to the value it returns when called; the call is still logged. */
  returns?: Record<string, (...args: any[]) => unknown>;
};
