import "./Spinner.css";

export type SpinnerProps = {
  /** Draws the ring in the foreground colour for use on an accent-coloured background. */
  inverse?: boolean;
};

/** A small rotating ring that shows work is in progress. Decorative: pair it with visible or screen-reader text. */
export function Spinner({ inverse }: SpinnerProps) {
  return <span className={inverse ? "spinner spinner-inverse" : "spinner"} aria-hidden="true" />;
}
