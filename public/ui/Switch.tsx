import { motion } from "motion/react";
import { useState } from "react";
import { SPRING } from "../lib/motion.ts";
import "./Switch.css";

export type SwitchProps = {
  /** Whether the switch is on. */
  checked: boolean;
  /** Called with the new state when the switch is toggled. */
  onChange: (next: boolean) => void;
  /** Accessible name announced for the switch. */
  label: string;
  /** Prevents toggling and dims the switch. */
  disabled?: boolean;
};

/** A two-state toggle with a sliding knob, exposed to assistive tech as a switch. */
export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      role="switch"
      className="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <motion.span
        className="knob"
        initial={false}
        animate={{ x: checked ? 18 : 0, scale: hovered && !disabled ? 1.12 : 1 }}
        transition={SPRING.toggle}
      />
    </button>
  );
}
