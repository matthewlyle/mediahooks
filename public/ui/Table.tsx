import { AnimatePresence, motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { EASE, flash } from "../lib/motion.ts";
import "./Table.css";

const HEIGHT_IN = { duration: 0.3, ease: [0.25, 1, 0.5, 1] } as const;
const HEIGHT_OUT = { duration: 0.2, ease: EASE.outQuint } as const;
const FADE_IN = { duration: 0.2, ease: EASE.css } as const;

/** Fade-out timing for a row or detail panel leaving the table. */
export const FADE_OUT = { duration: 0.12, ease: EASE.css } as const;

/** Tracks the rendered height of an element, for animating a container to fit its content. */
export function useHeight<T extends HTMLElement>(): [RefObject<T | null>, number | null] {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry?.borderBoxSize[0];
      if (box) setHeight(box.blockSize);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, height];
}

export type TableProps = {
  /** Column labels shown above the rows; omit for a table without a header. */
  head?: ReactNode;
  /** Class names for the header row, used to lay out the columns. */
  headClassName?: string;
  /** Class names for the list of rows, used to lay out the columns. */
  className?: string;
  /** The rows, usually `TableRow` elements. */
  children?: ReactNode;
};

/** A list of expandable rows with an optional column header. */
export function Table({ head, headClassName, className, children }: TableProps) {
  return (
    <>
      {head && <TableHead className={headClassName}>{head}</TableHead>}
      <ul className={["table", className].filter(Boolean).join(" ")}>{children}</ul>
    </>
  );
}

export type TableHeadProps = {
  /** Column labels. Hidden from assistive technology, since each row's summary announces its own labels. */
  children?: ReactNode;
  /** Extra class names, used to lay out the columns. */
  className?: string;
};

/** The column header row of a table; it is visual only. */
export function TableHead({ className, children }: TableHeadProps) {
  return (
    <div className={["table-head", className].filter(Boolean).join(" ")} aria-hidden="true">
      {children}
    </div>
  );
}

export type TableRowProps = Omit<HTMLMotionProps<"li">, "children" | "ref"> & {
  /** The always-visible content of the row, rendered inside its toggle button. */
  summary: ReactNode;
  /** Content revealed below the summary when the row is open. */
  detail: ReactNode;
  /** Whether the detail is shown. */
  open: boolean;
  /** Called when the summary is pressed, to open or close the row. */
  onToggle: () => void;
  /** Id of the detail panel, which the summary points to with `aria-controls` while open. */
  detailId: string;
  /** Class name for the summary button, used to lay out the columns. */
  summaryClassName?: string;
  /** Class name for the padded wrapper around the detail. */
  detailClassName?: string;
  /** Briefly highlights the row when it mounts, to mark it as newly arrived. */
  fresh?: boolean;
};

/** A list item whose summary button expands a height-animated detail panel beneath it. */
export function TableRow({
  summary,
  detail,
  open,
  onToggle,
  detailId,
  summaryClassName,
  detailClassName,
  fresh,
  className,
  ...rest
}: TableRowProps) {
  const row = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (fresh) flash(row.current);
  }, [fresh]);

  return (
    <motion.li ref={row} layout="position" className={["table-row", open && "open", className].filter(Boolean).join(" ")} {...rest}>
      <button
        type="button"
        className={["table-summary", summaryClassName].filter(Boolean).join(" ")}
        aria-expanded={open}
        aria-controls={open ? detailId : undefined}
        onClick={onToggle}
      >
        {summary}
      </button>
      <AnimatePresence>
        {open && (
          <TableDetail key="detail" id={detailId} className={detailClassName}>
            {detail}
          </TableDetail>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function TableDetail({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  const [inner, height] = useHeight<HTMLDivElement>();
  return (
    <motion.div
      id={id}
      className="table-detail"
      initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, height: height ?? 0 }}
      exit={
        reduce
          ? { opacity: 0, transition: FADE_OUT }
          : { opacity: 0, height: 0, transition: { height: HEIGHT_OUT, opacity: FADE_OUT } }
      }
      transition={{ height: HEIGHT_IN, opacity: FADE_IN }}
    >
      <div ref={inner} className={className}>
        {children}
      </div>
    </motion.div>
  );
}
