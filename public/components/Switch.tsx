import { motion } from "motion/react";
import { useState } from "react";
import { SPRING } from "../lib/motion.ts";

export type SwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
};

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
