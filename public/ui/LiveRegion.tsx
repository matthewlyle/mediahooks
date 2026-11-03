import type { HTMLAttributes } from "react";
import "./LiveRegion.css";

export type LiveRegionProps = Omit<HTMLAttributes<HTMLElement>, "role" | "aria-live"> & {
  /** How urgently a screen reader announces changes to the content: polite waits for the user to pause, assertive interrupts. Defaults to polite. */
  politeness?: "polite" | "assertive";
  /** Shows the content on screen as well as announcing it. Defaults to false, which hides it visually and leaves it to screen readers. */
  visible?: boolean;
  /** HTML element the region renders as. Defaults to span. */
  as?: "span" | "div" | "p";
};

/** A status region that screen readers announce when its content changes. */
export function LiveRegion({ politeness = "polite", visible = false, as: Tag = "span", className, ...rest }: LiveRegionProps) {
  return (
    <Tag
      role="status"
      aria-live={politeness}
      className={[visible ? undefined : "live-region-hidden", className].filter(Boolean).join(" ") || undefined}
      {...rest}
    />
  );
}
