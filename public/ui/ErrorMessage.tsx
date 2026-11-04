import { motion, type HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";
import "./ErrorMessage.css";

export type ErrorMessageProps = HTMLMotionProps<"p"> & {
  /** The error text. */
  children?: ReactNode;
};

/** A block of error text in the error color. */
export function ErrorMessage({ className, ...rest }: ErrorMessageProps) {
  return <motion.p className={["error-message", className].filter(Boolean).join(" ")} {...rest} />;
}
