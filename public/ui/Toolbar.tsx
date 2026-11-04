import { motion, type HTMLMotionProps } from "motion/react";
import "./Toolbar.css";

type Gap = "small" | "medium" | "large";

export type ToolbarProps = HTMLMotionProps<"div"> & {
  /** Space between the items: small, medium or large. Defaults to small. */
  gap?: Gap;
  /** Pushes the items to the end of the row instead of the start. */
  end?: boolean;
};

/** A row of controls aligned on one line, such as buttons, switches and badges. */
export function Toolbar({ gap = "small", end, className, ...rest }: ToolbarProps) {
  return <motion.div className={["toolbar", `toolbar-${gap}`, end && "toolbar-end", className].filter(Boolean).join(" ")} {...rest} />;
}
