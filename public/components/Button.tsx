import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { useLinkProps, type NavigateOptions } from "../lib/nav.ts";
import { SPRING, TAP } from "../lib/motion.ts";

type Variant = "primary" | "danger";

export type ButtonProps = HTMLMotionProps<"button"> & { variant?: Variant };

export function Button({ variant, className, type = "button", whileTap, transition, ...rest }: ButtonProps) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type={type}
      className={[variant, className].filter(Boolean).join(" ") || undefined}
      whileTap={reduce ? undefined : (whileTap ?? TAP)}
      transition={transition ?? SPRING.press}
      {...rest}
    />
  );
}

export type LinkButtonProps = Omit<HTMLMotionProps<"a">, "href"> & {
  to: string;
  nav?: NavigateOptions;
  variant?: Variant;
};

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
