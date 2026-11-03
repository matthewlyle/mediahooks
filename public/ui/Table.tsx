import { AnimatePresence, motion, type HTMLMotionProps } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
import { flash } from "../lib/motion.ts";
import { HeightReveal } from "./HeightReveal.tsx";
import "./Table.css";

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
  return (
    <HeightReveal presence id={id} className="table-detail" innerClassName={className}>
      {children}
    </HeightReveal>
  );
}
