import type { ReactNode } from "react";
import "./CodeBlock.css";

export type CodeBlockProps = {
  /** Caption shown above the block. */
  label?: string;
  /** Muted text at the start of the block, such as a request line and headers. */
  head?: string;
  /** Whether the block has its own inset background. Turn it off to place the block inside a surface that already has one. Defaults to true. */
  inset?: boolean;
  /** Extra class name for the block. */
  className?: string;
  /** Monospace text shown in the block. */
  children?: ReactNode;
};

/** A caption for a block of raw text. */
export function CodeLabel({ children }: { children: ReactNode }) {
  return <span className="code-label">{children}</span>;
}

/** A scrollable monospace block for raw text such as payloads and messages, with an optional label above it. */
export function CodeBlock({ label, head, inset = true, className, children }: CodeBlockProps) {
  return (
    <>
      {label && <CodeLabel>{label}</CodeLabel>}
      <pre className={["code-block", inset ? "code-block-inset" : "code-block-plain", "mono", className].filter(Boolean).join(" ")}>
        {head && <span className="code-block-head">{head}</span>}
        {children}
      </pre>
    </>
  );
}
