import { motion, type HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";
import "./EmptyState.css";

const TAGS = { p: motion.p, li: motion.li, div: motion.div };

type Size = "large" | "medium" | "small" | "plain";

export type EmptyStateProps = Omit<HTMLMotionProps<"div">, "children"> & {
  /** Element rendered: a paragraph, a list item or a div. Defaults to p. */
  as?: keyof typeof TAGS;
  /** How much room the message takes: large for a whole page, medium for a panel, small for a row in a list, plain for a line inside content that has its own padding. Defaults to large. */
  size?: Size;
  /** The message: that nothing is here, or why it couldn't load. */
  children?: ReactNode;
  /** A button or link offered under the message. When set, the message is left-aligned and has no padding. */
  action?: ReactNode;
};

/** A muted message that stands in for content that is missing, empty or failed to load. */
export function EmptyState({ as = "p", size = "large", action, className, children, ...rest }: EmptyStateProps) {
  const Tag = TAGS[as] as typeof motion.div;
  const classes = ["empty-state", `empty-state-${action ? "action" : size}`, className].filter(Boolean).join(" ");
  return (
    <Tag className={classes} {...rest}>
      {action ? (
        <>
          <p>{children}</p>
          {action}
        </>
      ) : (
        children
      )}
    </Tag>
  );
}
