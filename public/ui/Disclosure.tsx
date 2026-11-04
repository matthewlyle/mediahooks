import { AnimatePresence } from "motion/react";
import { useId, type ReactNode } from "react";
import { Reveal } from "./Reveal.tsx";
import "./Disclosure.css";

export type DisclosureProps = {
  /** Text of the toggle button. */
  label: ReactNode;
  /** Muted monospace text after the label, such as a count of what is inside. */
  summary?: ReactNode;
  /** Whether the content is shown. */
  open: boolean;
  /** Called with the new state when the toggle is pressed. */
  onOpenChange: (open: boolean) => void;
  /** Id for the toggle button, so other elements can reference it as a label. */
  id?: string;
  /** Extra class names for the toggle button, for placement by the caller. */
  className?: string;
  /** Content revealed when open. */
  children: ReactNode;
};

/** A chevron toggle that shows and hides a block of content with a height animation. */
export function Disclosure({ label, summary, open, onOpenChange, id, className, children }: DisclosureProps) {
  const contentId = useId();
  return (
    <div className="disclosure-group">
      <button
        type="button"
        id={id}
        className={["disclosure", className].filter(Boolean).join(" ")}
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => onOpenChange(!open)}
      >
        {label}
        {summary != null && (
          <>
            {" "}
            <span className="disclosure-summary">{summary}</span>
          </>
        )}
      </button>
      <div id={contentId}>
        <AnimatePresence initial={false}>{open && <Reveal key="content">{children}</Reveal>}</AnimatePresence>
      </div>
    </div>
  );
}
