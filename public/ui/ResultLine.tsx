import "./ResultLine.css";

/** Formats a duration in milliseconds as text like "120ms". */
export const formatDuration = (ms: number) => `${ms}ms`;

/** Strips HTML tags and collapses whitespace in an error message so it fits on one line. */
export const cleanError = (error: string | null | undefined) => (error ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

/** The single-line text for what a delivery returned: a text with ✓ or ✗, the HTTP status, and the duration or error. */
export function resultText({ ok, status, durationMs, error }: ResultLineProps) {
  const detail = ok ? formatDuration(durationMs) : cleanError(error) || formatDuration(durationMs);
  return { mark: ok ? "✓" : "✗", summary: `${status ?? "ERR"} · ${detail}` };
}

export type ResultLineProps = {
  /** Whether the delivery succeeded; it sets the green or red tone and the ✓ or ✗ mark. */
  ok: boolean;
  /** HTTP status code the receiver returned, or null when no response came back (shown as ERR). */
  status: number | null;
  /** How long the request took in milliseconds; shown when it succeeded or no error text is available. */
  durationMs: number;
  /** Error text shown instead of the duration when the delivery failed. */
  error?: string | null;
  /** Extra class names for the line. */
  className?: string;
};

/** One line of monospace text that reports a delivery's result: its mark, status and duration or error, tinted green or red. */
export function ResultLine(props: ResultLineProps) {
  const { ok, className } = props;
  const { mark, summary } = resultText(props);
  return (
    <span className={["result-line", ok ? "result-line-ok" : "result-line-fail", className].filter(Boolean).join(" ")}>
      <span aria-hidden="true">{mark} </span>
      {summary}
    </span>
  );
}
