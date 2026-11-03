import type { ReactNode } from "react";
import "./Check.css";

export type CheckProps = {
  /** Whether the box is filled. */
  checked: boolean;
  /** Greys the row out and ignores clicks. */
  disabled?: boolean;
  /** Called when the row is clicked while enabled. */
  onToggle: () => void;
  /** Native tooltip shown on hover. */
  title?: string;
  /** Label shown beside the box. */
  children: ReactNode;
};

/** A menu row with a small square that fills when checked. */
export function Check({ checked, disabled, onToggle, title, children }: CheckProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      className="pop-option"
      title={title}
      onClick={() => !disabled && onToggle()}
    >
      <span className="pop-check" aria-hidden="true" />
      {children}
    </button>
  );
}
