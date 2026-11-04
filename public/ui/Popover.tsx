import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { EASE, SPRING, useNarrow } from "../lib/motion.ts";
import "./Popover.css";

export type PopoverProps = {
  /** DOM id of the dialog, for the trigger's `aria-controls`. */
  id: string;
  /** Whether the popover is shown. */
  open: boolean;
  /** Accessible name of the dialog; also the title of the bottom sheet. */
  label: string;
  /** Element the popover opens below. Triggers that set `aria-haspopup="dialog"` keep their own pointer events. */
  anchor: HTMLElement | null;
  /** Called when the popover asks to close; `instant` skips the exit animation, `focus` asks to return focus to the trigger. */
  onClose: (opts: { instant?: boolean; focus?: boolean }) => void;
  /** Content shown inside the popover. */
  children: ReactNode;
};

/** A dialog anchored below its trigger, which becomes a bottom sheet on narrow screens. */
export function Popover({ id, open, label, anchor, onClose, children }: PopoverProps) {
  const reduce = useReducedMotion();
  const sheet = useNarrow();
  const pop = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({});
  const [instant, setInstant] = useState(false);
  const close = useRef(onClose);
  close.current = (opts) => {
    setInstant(Boolean(opts.instant));
    onClose(opts);
  };

  const focusables = () => [...(pop.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input") ?? [])];

  useLayoutEffect(() => {
    if (!open || !pop.current || !anchor) return;
    setInstant(false);
    if (!sheet) {
      const lines = anchor.getClientRects();
      const rect = lines[lines.length - 1] ?? anchor.getBoundingClientRect();
      const width = pop.current.offsetWidth;
      const left = Math.max(12, Math.min(rect.left, document.documentElement.clientWidth - width - 12));
      setStyle({
        top: rect.bottom + 6,
        left,
        maxHeight: Math.max(160, innerHeight - rect.bottom - 18),
        transformOrigin: `${rect.left - left + 12}px 0`,
      });
    }
    focusables()[0]?.focus({ preventScroll: true });
  }, [open, label, anchor, sheet]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element;
      if (pop.current?.contains(target) || target.closest?.('[aria-haspopup="dialog"]')) return;
      close.current({});
    };
    const onScroll = () => close.current({});
    document.addEventListener("pointerdown", onPointerDown, true);
    // A sheet stays put; resizing is the phone keyboard or toolbar moving.
    if (!sheet) {
      addEventListener("scroll", onScroll, { passive: true });
      addEventListener("resize", onScroll);
    }
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
    };
  }, [open, sheet]);

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      close.current({ instant: true, focus: true });
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const list = focusables();
    const index = list.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "ArrowDown" ? index + 1 : index - 1;
    list[(next + list.length) % list.length]?.focus();
  }

  const fade = (isInstant: boolean) => ({ opacity: 0, transition: { duration: isInstant ? 0 : 0.1, ease: EASE.css } });
  const motionProps = sheet
    ? {
        initial: reduce ? { opacity: 0 } : { y: "100%" },
        animate: { opacity: 1, y: 0, transition: reduce ? { duration: 0.12 } : SPRING.page },
        variants: {
          exit: (isInstant: boolean) =>
            reduce || isInstant ? fade(isInstant) : { y: "100%", transition: { duration: 0.2, ease: EASE.outQuint } },
        },
      }
    : {
        initial: reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.97 },
        animate: { opacity: 1, y: 0, scale: 1, transition: { duration: reduce ? 0.12 : 0.15, ease: EASE.outQuint } },
        variants: { exit: fade },
      };

  return createPortal(
    <AnimatePresence custom={instant}>
      {open && sheet && (
        <motion.div
          key="scrim"
          className="sheet-scrim"
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.2, ease: EASE.css } }}
          custom={instant}
          variants={{ exit: fade }}
          exit="exit"
        />
      )}
      {open && (
        <motion.div
          key="pop"
          ref={pop}
          id={id}
          role="dialog"
          aria-label={label}
          className={sheet ? "menu sentence-pop sheet" : "menu sentence-pop"}
          style={sheet ? undefined : style}
          custom={instant}
          {...motionProps}
          exit="exit"
          onKeyDown={onKeyDown}
        >
          {sheet && (
            <div className="sheet-head">
              <span>{label}</span>
              <button type="button" className="sheet-done" onClick={() => close.current({ focus: true })}>
                Done
              </button>
            </div>
          )}
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
