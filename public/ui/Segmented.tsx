import { motion } from "motion/react";
import { useId } from "react";
import { SPRING } from "../lib/motion.ts";
import "./Segmented.css";

export type SegmentedProps<T extends string> = {
  /** Accessible name for the group. */
  label: string;
  /** Choices as `[value, text]` pairs, in display order. */
  options: readonly (readonly [T, string])[];
  /** The selected option's value. */
  value: T;
  /** Called with the value of the option the user picks. */
  onChange: (v: T) => void;
  /** Extra class names for the group, for placement by the caller. */
  className?: string;
};

/** A row of mutually exclusive choices where the selected one is marked by a pill that slides between options. */
export function Segmented<T extends string>({ label, options, value, onChange, className }: SegmentedProps<T>) {
  const pill = useId();
  return (
    <span className={["segmented", className].filter(Boolean).join(" ")} role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>
          {value === v && (
            <motion.span
              layoutId={pill}
              className="segmented-pill"
              style={{ borderRadius: "var(--radius-2)" }}
              transition={SPRING.morph}
              aria-hidden="true"
            />
          )}
          <span className="segmented-label">{text}</span>
        </button>
      ))}
    </span>
  );
}
