import { useId } from "react";
import "./Checkbox.css";

export type CheckboxProps = {
  /** Whether the box is ticked. */
  checked: boolean;
  /** Called with the new state when the box is toggled. */
  onChange: (next: boolean) => void;
  /** Text beside the box, which also names it. */
  label: string;
  /** Short note under or after the label, read out as the box's description. */
  hint?: string;
  /** Prevents toggling and dims the checkbox. */
  disabled?: boolean;
  /** Extra class names for the wrapper, for placement by the caller. */
  className?: string;
};

/** A native checkbox with a clickable label and an optional hint. */
export function Checkbox({ checked, onChange, label, hint, disabled, className }: CheckboxProps) {
  const hintId = useId();
  return (
    <label className={["checkbox", className].filter(Boolean).join(" ")}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-describedby={hint ? hintId : undefined}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="checkbox-label">{label}</span>
      {hint && (
        <span id={hintId} className="checkbox-hint">
          {hint}
        </span>
      )}
    </label>
  );
}
