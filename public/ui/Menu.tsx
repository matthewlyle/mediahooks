import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { EASE } from "../lib/motion.ts";
import { Button } from "./Button.tsx";

import "./Menu.css";

export type MenuItem = {
  /** Text shown for the item. */
  label: string;
  /** Called when the item is chosen. */
  onSelect: () => void;
  /** Tints the item red to mark a destructive action. */
  danger?: boolean;
  /** Greys the item out and skips it in keyboard navigation. */
  disabled?: boolean;
};

export type MenuProps = {
  /** Accessible name of the trigger button and the menu. */
  label: string;
  /** Actions listed in the menu, in order. */
  items: MenuItem[];
  /** Content of the trigger button. Ignored when `overflow` is set. */
  children?: ReactNode;
  /** Shows the trigger as three dots, for an overflow menu of row actions. */
  overflow?: boolean;
  /** Extra class name for the trigger button. */
  triggerClassName?: string;
  /** Which edge of the trigger the menu lines up with. */
  align?: "start" | "end";
  /** Optional line of text shown above the items. */
  heading?: string;
};

type Placement = { top: number; left?: number; right?: number };

/** A button that opens a popup list of actions, with arrow-key navigation and focus return on close. */
export function Menu({ label, items, children, overflow, triggerClassName, align = "end", heading }: MenuProps) {
  const reduce = useReducedMotion();
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement>({ top: 0 });
  const [instant, setInstant] = useState(false);
  const focusOnOpen = useRef<"first" | "last">("first");

  function openMenu(focus: "first" | "last") {
    const rect = trigger.current!.getBoundingClientRect();
    setPlacement(
      align === "end"
        ? { top: rect.bottom + 4, right: document.documentElement.clientWidth - rect.right }
        : { top: rect.bottom + 4, left: rect.left },
    );
    focusOnOpen.current = focus;
    setInstant(false);
    setOpen(true);
  }

  function close(opts: { instant?: boolean; focusTrigger?: boolean } = {}) {
    setInstant(Boolean(opts.instant));
    setOpen(false);
    if (opts.focusTrigger) trigger.current?.focus({ preventScroll: true });
  }

  const enabledItems = () => [...(menu.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];

  useLayoutEffect(() => {
    if (!open) return;
    const list = enabledItems();
    (focusOnOpen.current === "first" ? list[0] : list.at(-1))?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menu.current?.contains(target) || trigger.current?.contains(target)) return;
      const hadFocus = menu.current?.contains(document.activeElement) ?? false;
      close({ focusTrigger: hadFocus });
    };
    const onScroll = () => close();
    document.addEventListener("pointerdown", onPointerDown, true);
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
    };
  }, [open]);

  const [location] = useLocation();
  const openedAt = useRef(location);
  useEffect(() => {
    if (open && location !== openedAt.current) close({ instant: true });
    openedAt.current = location;
  }, [location]);

  function onTriggerKeyDown(event: KeyboardEvent) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    openMenu(event.key === "ArrowDown" ? "first" : "last");
  }

  function onMenuKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      close({ instant: true, focusTrigger: true });
      return;
    }
    const list = enabledItems();
    const index = list.indexOf(document.activeElement as HTMLButtonElement);
    const move: Record<string, number> = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: list.length - 1 };
    if (!(event.key in move)) return;
    event.preventDefault();
    list[(move[event.key]! + list.length) % list.length]?.focus();
  }

  const style: CSSProperties = {
    top: placement.top,
    left: placement.left,
    right: placement.right,
    transformOrigin: align === "end" ? "top right" : "top left",
  };

  return (
    <>
      <Button
        ref={trigger}
        className={[overflow && "menu-overflow", triggerClassName].filter(Boolean).join(" ") || undefined}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? close() : openMenu("first"))}
        onKeyDown={onTriggerKeyDown}
      >
        {overflow ? (
          <>
            <span className="menu-dot" />
            <span className="menu-dot" />
            <span className="menu-dot" />
          </>
        ) : (
          children
        )}
      </Button>
      {createPortal(
        <AnimatePresence custom={instant}>
          {open && (
            <motion.div
              key="menu"
              ref={menu}
              id={id}
              role="menu"
              aria-label={label}
              className="menu"
              style={style}
              custom={instant}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: reduce ? 0.12 : 0.15, ease: EASE.outQuint } }}
              variants={{
                exit: (isInstant: boolean) => ({
                  opacity: 0,
                  transition: { duration: isInstant ? 0 : 0.1, ease: EASE.css },
                }),
              }}
              exit="exit"
              onKeyDown={onMenuKeyDown}
            >
              {heading && (
                <div className="menu-heading" aria-hidden="true">
                  {heading}
                </div>
              )}
              {items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  className={item.danger ? "danger" : undefined}
                  disabled={item.disabled}
                  onClick={() => {
                    close({ focusTrigger: true });
                    item.onSelect();
                  }}
                >
                  {item.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
