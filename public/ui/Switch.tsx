import { motion } from "motion/react";
import { useState } from "react";
import { SPRING } from "../lib/motion.ts";
import "./Switch.css";

export type SwitchProps = {
  /** Whether the switch is on. */
  checked: boolean;
  /** Called with the new state when the switch is toggled. */
  onChange: (next: boolean) => void;
  /** Visible text beside the switch that names it; clicking it toggles the switch. */
  label?: string;
  /** Accessible name for a switch with no visible label. */
  "aria-label"?: string;
  /** Prevents toggling and dims the switch. */
  disabled?: boolean;
};

/** A two-state toggle with a sliding knob, exposed to assistive tech as a switch. */
export function Switch({ checked, onChange, label, "aria-label": ariaLabel, disabled }: SwitchProps) {
  const [hovered, setHovered] = useState(false);
  const control = (
    <button
      type="button"
      role="switch"
      className="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
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
  if (label === undefined) return control;
  return (
    <label className="switch-label">
      {label}
      {control}
    </label>
  );
}
