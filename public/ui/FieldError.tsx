import { AnimatePresence } from "motion/react";
import { Reveal } from "../pages/editor/Reveal.tsx";
import "./FieldError.css";

/** A validation message under a form field that animates in and out as the error appears or clears. */
export function FieldError({ id, error }: {
  /** DOM id set on the message paragraph. */
  id: string;
  /** Message text. Empty or undefined hides the message. */
  error: string | undefined;
}) {
  return (
    <div className="reveal-region" role="status">
      <AnimatePresence initial={false}>
        {error && (
          <Reveal key="error">
            <p id={id} className="field-error">
              {error}
            </p>
          </Reveal>
        )}
      </AnimatePresence>
    </div>
  );
}
