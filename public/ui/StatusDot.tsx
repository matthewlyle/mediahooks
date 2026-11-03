import "./StatusDot.css";

export type StatusDotProps = {
  /** Whether the dot is lit green; off is a dim grey dot. */
  on: boolean;
};

/** A small round dot that shows whether something is connected or live. */
export function StatusDot({ on }: StatusDotProps) {
  return <span className={on ? "status-dot on" : "status-dot"} aria-hidden="true" />;
}
