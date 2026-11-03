import { motion, type HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";
import "./Badge.css";

type Tone = "neutral" | "success" | "error";

export type BadgeProps = HTMLMotionProps<"span"> & {
  /** Meaning of the badge: neutral is a quiet label, success and error tint the text and background green or red. Defaults to neutral. */
  tone?: Tone;
  /** Text or content shown inside the badge. */
  children?: ReactNode;
};

/** A small monospace label that marks the state of something. */
export function Badge({ tone = "neutral", className, ...rest }: BadgeProps) {
  return <motion.span className={["badge", `badge-${tone}`, className].filter(Boolean).join(" ")} {...rest} />;
}
