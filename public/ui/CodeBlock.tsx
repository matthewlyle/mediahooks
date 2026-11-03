import type { ReactNode } from "react";
import { EmptyState } from "./EmptyState.tsx";
import "./CodeBlock.css";

export type CodeBlockProps = {
  /** Caption shown above the block. */
  label?: string;
  /** Muted text at the start of the block, such as a request line and headers. */
  head?: string;
  /** Muted message shown instead of the block when there is nothing to show, such as a missing response. */
  note?: string;
  /** Whether the block has its own inset background. Turn it off to place the block inside a surface that already has one. Defaults to true. */
  inset?: boolean;
  /** Extra class name for the block. */
  className?: string;
  /** Monospace text shown in the block. */
  children?: ReactNode;
};

/** A scrollable monospace block for raw text such as payloads and messages, with an optional label above it. */
export function CodeBlock({ label, note, head, inset = true, className, children }: CodeBlockProps) {
  return (
    <>
      {label && <span className="code-label">{label}</span>}
      {note !== undefined ? (
        <EmptyState size="plain">{note}</EmptyState>
      ) : (
        <pre className={["code-block", inset ? "code-block-inset" : "code-block-plain", "mono", className].filter(Boolean).join(" ")}>
          {head && <span className="code-block-head">{head}</span>}
          {children}
        </pre>
      )}
    </>
  );
}
