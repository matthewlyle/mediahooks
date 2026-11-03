import type { ChangeEvent } from "react";
import "./Select.css";

export type SelectProps = {
  /** Accessible name announced for the select, which has no visible label. */
  label: string;
  /** The value of the selected option. */
  value: string;
  /** The choices as `[value, label]` pairs, in display order. */
  options: [string, string][];
  /** Called with the change event when another option is chosen. */
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  /** Prevents choosing and dims the select. */
  disabled?: boolean;
  /** Extra class name for placing the select in its page. */
  className?: string;
};

/** A native dropdown select with a drawn chevron. */
export function Select({ label, value, options, onChange, disabled, className }: SelectProps) {
  return (
    <select
      className={["select", className].filter(Boolean).join(" ")}
      aria-label={label}
      value={value}
      onChange={onChange}
      disabled={disabled}
    >
      {options.map(([id, text]) => (
        <option key={id} value={id}>
          {text}
        </option>
      ))}
    </select>
  );
}
