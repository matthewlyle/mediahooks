import { createContext, useContext, type ComponentProps, type ReactNode } from "react";
import { FieldError } from "./FieldError.tsx";
import "./Field.css";

type FieldControl = {
  invalid: boolean;
  describedBy: string | undefined;
};

const FieldControlContext = createContext<FieldControl>({ invalid: false, describedBy: undefined });

/** Reports whether the surrounding field shows an error, and the id of the element that holds it. */
export function useFieldControl() {
  return useContext(FieldControlContext);
}

/** A text input, set in the body font with `prose`, that reports the surrounding field's error through `aria-invalid` and `aria-describedby`. */
export function FieldInput({ prose, className, ...props }: ComponentProps<"input"> & { prose?: boolean }) {
  const { invalid, describedBy } = useFieldControl();
  const classes = ["field-input", prose && "field-input-prose", className].filter(Boolean).join(" ");
  return <input className={classes} aria-invalid={invalid} aria-describedby={describedBy} {...props} />;
}

export type FieldProps = {
  /** Id of the control, which the label points at. */
  id: string;
  /** Label text. Omit when something else names the control. */
  label?: ReactNode;
  /** Short note beside the label, such as "required" or "optional". */
  hint?: ReactNode;
  /** Id given to the label, for a control that is named with `aria-labelledby` instead of the label's `for`. */
  labelId?: string;
  /** Called when the label is clicked, for a control the browser can't focus through its label. */
  onLabelClick?: () => void;
  /** Validation message shown under the control. Empty or undefined shows none. */
  error: string | undefined;
  /** DOM id of the error message. */
  errorId: string;
  /** Extra class names for the wrapper, for placement by the caller. */
  className?: string;
  /** Content shown under the error message. */
  footer?: ReactNode;
  /** The control. Use `FieldInput` for a text input, or `useFieldControl` to wire another control. */
  children: ReactNode;
};

/** A form field: a label with an optional hint, the control, and a validation message wired to the control. */
export function Field({
  id,
  label,
  hint,
  labelId,
  onLabelClick,
  error,
  errorId,
  className,
  footer,
  children,
}: FieldProps) {
  return (
    <div className={["field", className].filter(Boolean).join(" ")}>
      {label && (
        <label id={labelId} htmlFor={labelId ? undefined : id} onClick={onLabelClick}>
          <span>
            {label} {hint && <span className="field-hint">{hint}</span>}
          </span>
        </label>
      )}
      <FieldControlContext.Provider value={{ invalid: Boolean(error), describedBy: error ? errorId : undefined }}>
        {children}
      </FieldControlContext.Provider>
      <FieldError id={errorId} error={error} />
      {footer}
    </div>
  );
}
