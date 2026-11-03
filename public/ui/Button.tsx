import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";
import { useLinkProps, type NavigateOptions } from "../lib/nav.ts";
import { SPRING, TAP } from "../lib/motion.ts";
import "./Button.css";

type Variant = "primary" | "danger";

export type ButtonSize = "small" | "chip" | "large" | "avatar";

export type ButtonProps = HTMLMotionProps<"button"> & {
  /** Emphasis: primary fills with the accent color, danger tints the label red. Omit for the default raised button. */
  variant?: Variant;
  /** Dimensions: small is compact, chip is smaller still with a muted label, large is the sign-in size, avatar is a 28px circle. Omit for the default size. */
  size?: ButtonSize;
  /** Label or content shown inside the button. */
  children?: ReactNode;
};

/** A pressable button that scales down while pressed and defaults to `type="button"`. */
export function Button({ variant, size, className, type = "button", whileTap, transition, ...rest }: ButtonProps) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type={type}
      data-size={size}
      className={[variant, className].filter(Boolean).join(" ") || undefined}
      whileTap={reduce ? undefined : (whileTap ?? TAP)}
      transition={transition ?? SPRING.press}
      {...rest}
    />
  );
}

export type LinkButtonProps = Omit<HTMLMotionProps<"a">, "href"> & {
  /** In-app path the link navigates to. */
  to: string;
  /** Navigation options passed through when the link is followed. */
  nav?: NavigateOptions;
  /** Emphasis: primary fills with the accent color. Omit for the default raised button. */
  variant?: Variant;
  /** Label or content shown inside the link. */
  children?: ReactNode;
};

/** An in-app link that looks like a Button. */
export function LinkButton({ to, nav, variant, className, whileTap, transition, onClick, ...rest }: LinkButtonProps) {
  const reduce = useReducedMotion();
  const link = useLinkProps(to, nav);
  return (
    <motion.a
      href={link.href}
      className={["button", variant, className].filter(Boolean).join(" ")}
      whileTap={reduce ? undefined : (whileTap ?? TAP)}
      transition={transition ?? SPRING.press}
      onClick={(e) => {
        onClick?.(e);
        link.onClick(e);
      }}
      {...rest}
    />
  );
}
