import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";
import { useLinkProps, type NavigateOptions } from "../lib/nav.ts";
import { SPRING, TAP } from "../lib/motion.ts";
import { Spinner } from "./Spinner.tsx";
import "./Button.css";

type Variant = "primary" | "danger";

export type ButtonSize = "small" | "large";

export type ButtonProps = HTMLMotionProps<"button"> & {
  /** Emphasis: primary fills with the accent color, danger tints the label red. Omit for the default raised button. */
  variant?: Variant;
  /** Dimensions: small is compact, large is the sign-in size. Omit for the default size. */
  size?: ButtonSize;
  /** Label or content shown inside the button. */
  children?: ReactNode;
  /** Work started by the button is in progress: it sets `aria-busy`, ignores clicks and keeps its width. */
  busy?: boolean;
  /** Whether a busy button covers its label with a spinner. Turn off when the content shows its own progress. */
  spinner?: boolean;
};

/** A pressable button that scales down while pressed, defaults to `type="button"` and can show a busy state. */
export function Button({ variant, size, className, type = "button", whileTap, transition, busy, spinner = true, onClick, children, ...rest }: ButtonProps) {
  const reduce = useReducedMotion();
  const cover = busy && spinner;
  return (
    <motion.button
      type={type}
      data-size={size}
      data-busy={busy || undefined}
      data-cover={cover || undefined}
      aria-busy={busy || undefined}
      onClick={busy ? (e) => e.preventDefault() : onClick}
      className={[variant, className].filter(Boolean).join(" ") || undefined}
      whileTap={reduce ? undefined : (whileTap ?? TAP)}
      transition={transition ?? SPRING.press}
      {...rest}
    >
      {cover ? (
        <>
          <span className="button-label">{children}</span>
          <span className="button-busy" aria-hidden="true">
            {reduce ? "…" : <Spinner inverse={variant === "primary"} />}
          </span>
        </>
      ) : (
        children
      )}
    </motion.button>
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
