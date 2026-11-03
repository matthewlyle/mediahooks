import type { HTMLAttributes, ReactNode } from "react";
import "./SectionHeader.css";

export type SectionHeaderProps = Omit<HTMLAttributes<HTMLDivElement>, "children" | "title"> & {
  /** Heading level, 2 to 4. Without it the title is not a heading and is rendered as plain content. */
  level?: 2 | 3 | 4;
  /** Id of the heading element, for labelling the section it introduces. Only used with a level. */
  headingId?: string;
  /** The heading text, or content that leads the row. */
  title?: ReactNode;
  /** Controls placed at the trailing edge, such as a refresh button. */
  actions?: ReactNode;
  /** Extra content in the row after the title, laid out inline. */
  children?: ReactNode;
};

/** A row that introduces a section with an optional heading and controls at the trailing edge. */
export function SectionHeader({ level, headingId, title, actions, className, children, ...rest }: SectionHeaderProps) {
  const Heading = `h${level}` as "h2";
  const classes = ["section-header", actions && (level ? "section-header-split" : !title && "section-header-end"), className].filter(Boolean).join(" ");
  return (
    <div className={classes} {...rest}>
      {level ? (
        <Heading id={headingId} className="section-header-title">
          {title}
        </Heading>
      ) : (
        title
      )}
      {children}
      {actions}
    </div>
  );
}
