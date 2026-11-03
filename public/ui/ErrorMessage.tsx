import { motion, type HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";
import "./ErrorMessage.css";

export type ErrorMessageProps = HTMLMotionProps<"p"> & {
  /** The error text shown inside the faint red box. */
  children?: ReactNode;
};

/** A block of error text on a faint red tint. */
export function ErrorMessage({ className, ...rest }: ErrorMessageProps) {
  return <motion.p className={["error-message", className].filter(Boolean).join(" ")} {...rest} />;
}
