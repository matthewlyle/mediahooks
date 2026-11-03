import { motion, useReducedMotion } from "motion/react";
import { SPRING, TAP, ids } from "../lib/motion.ts";
import { useLinkProps } from "../lib/nav.ts";
import "./NavLink.css";

export type NavLinkProps = {
  /** In-app path the link navigates to. */
  to: string;
  /** Text shown in the link. */
  label: string;
  /** Whether this link marks the current section; the active link carries the shared indicator. */
  active: boolean;
};

/** A header navigation link whose active state is marked by an indicator that morphs between links. */
export function NavLink({ to, label, active }: NavLinkProps) {
  const link = useLinkProps(to);
  const reduce = useReducedMotion();
  return (
    <motion.a
      {...link}
      className="nav-link"
      aria-current={active ? "page" : undefined}
      whileTap={reduce ? undefined : TAP}
      transition={SPRING.press}
    >
      {active && (
        <motion.span
          layoutId={ids.nav}
          className="nav-indicator"
          style={{ borderRadius: "var(--radius-2)" }}
          transition={SPRING.morph}
          aria-hidden="true"
        />
      )}
      <span className="nav-label" data-label={label}>
        <span>{label}</span>
      </span>
    </motion.a>
  );
}
