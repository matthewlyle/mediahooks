import { useEffect, useRef, useState } from "react";
import { Button } from "./Button.tsx";
import "./CopyButton.css";

// Plain-http LAN addresses have no Clipboard API; the execCommand fallback is needed.
/** Writes text to the clipboard, falling back to execCommand where the Clipboard API is unavailable. Resolves false if both fail. */
export async function copyText(text: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch { }
  }
  const scratch = document.createElement("textarea");
  scratch.value = text;
  scratch.readOnly = true;
  scratch.style.position = "fixed";
  scratch.style.opacity = "0";
  document.body.append(scratch);
  scratch.select();
  const ok = document.execCommand("copy");
  scratch.remove();
  return ok;
}

const COPIED_MS = 1500;

export type CopyButtonProps = {
  /** Text written to the clipboard when the button is pressed. */
  text: string;
  /** Extra class names added to the button, for layout by the caller. */
  className?: string;
  /** Called when the copy fails, so the caller can select the text for manual copying. */
  onFail?: () => void;
};

/** A button that copies `text` and briefly shows a check mark and "Copied"; a failed copy is announced to screen readers. */
export function CopyButton({ text, className, onFail }: CopyButtonProps) {
  // A counter, not a boolean: each copy remounts the check so it redraws.
  const [copied, setCopied] = useState(0);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function onClick() {
    const ok = await copyText(text);
    clearTimeout(timer.current);
    setFailed(!ok);
    setCopied((n) => (ok ? n + 1 : 0));
    if (!ok) onFail?.();
    timer.current = setTimeout(() => {
      setCopied(0);
      setFailed(false);
    }, COPIED_MS);
  }

  return (
    <>
      <Button className={["copy-btn", className].filter(Boolean).join(" ")} onClick={onClick}>
        {copied ? (
          <>
            <svg key={copied} className="copy-check" viewBox="0 0 10 10" aria-hidden="true">
              <path
                d="M1.5 5.5 L4 8 L8.5 2"
                pathLength={1}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Copied
          </>
        ) : (
          "Copy"
        )}
      </Button>
      <span className="sr-only" role="status">
        {copied ? "Copied" : failed ? "Couldn't copy" : ""}
      </span>
    </>
  );
}
