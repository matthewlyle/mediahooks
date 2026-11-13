import { motion, type HTMLMotionProps } from "motion/react";
import type { ElementType, ReactNode, Ref } from "react";

const TAGS = { section: motion.section, p: motion.p, form: motion.form } as const;

export type PanelProps = Omit<HTMLMotionProps<"form">, "ref"> & {
  /** Element the surface renders as: a section (the default), a paragraph, or a form. */
  as?: keyof typeof TAGS;
  /** Ref to the rendered element. */
  ref?: Ref<HTMLElement>;
  /** Tighter side padding, for a panel that holds a form. */
  dense?: boolean;
  /** Content shown on the surface. */
  children?: ReactNode;
};

/** A raised surface that groups a block of content on a page. */
export function Panel({ as = "section", dense, className, ...rest }: PanelProps) {
  const Tag: ElementType = TAGS[as];
  return <Tag className={["panel", dense && "panel-dense", className].filter(Boolean).join(" ")} {...rest} />;
}
