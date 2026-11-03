import { motion, type HTMLMotionProps } from "motion/react";
import type { MouseEvent, ReactNode } from "react";
import { useLinkProps } from "../lib/nav.ts";
import "./ClickableCard.css";

export type ClickableCardProps = Omit<HTMLMotionProps<"li">, "children"> & {
  /** In-app path the whole card opens. */
  to: string;
  /** Accessible name of the card's link. */
  label: string;
  /** Content the card's link covers. */
  children?: ReactNode;
  /** Controls placed beside the content; clicks on them don't open the card. */
  actions?: ReactNode;
};

/** A list card that opens a page when clicked anywhere, passing modified and middle clicks on to its link. */
export function ClickableCard({ to, label, children, actions, className, onClick, onAuxClick, ...rest }: ClickableCardProps) {
  const link = useLinkProps(to);

  function cardLink(event: MouseEvent<HTMLLIElement>): HTMLAnchorElement | null {
    const target = event.target as Element;
    // Clicks inside the menu portal bubble here through React; only real descendants count.
    if (!event.currentTarget.contains(target) || target.closest("button")) return null;
    const anchor = event.currentTarget.querySelector<HTMLAnchorElement>(".clickable-card-link");
    return anchor === target ? null : anchor;
  }

  function handleClick(event: MouseEvent<HTMLLIElement>) {
    onClick?.(event);
    const anchor = cardLink(event);
    if (!anchor || getSelection()?.toString()) return;
    const { metaKey, ctrlKey, shiftKey, altKey } = event;
    if (metaKey || ctrlKey || shiftKey || altKey) {
      anchor.dispatchEvent(new MouseEvent("click", { cancelable: true, view: window, metaKey, ctrlKey, shiftKey, altKey }));
      return;
    }
    link.onClick(event);
  }

  function handleAuxClick(event: MouseEvent<HTMLLIElement>) {
    onAuxClick?.(event);
    const anchor = cardLink(event);
    if (!anchor || event.button !== 1) return;
    const mac = /Mac|iPhone|iPad/.test(navigator.userAgent);
    anchor.dispatchEvent(new MouseEvent("click", { cancelable: true, view: window, metaKey: mac, ctrlKey: !mac }));
  }

  return (
    <motion.li className={["clickable-card", className].filter(Boolean).join(" ")} onClick={handleClick} onAuxClick={handleAuxClick} {...rest}>
      <div className="clickable-card-content">
        <a className="clickable-card-link" aria-label={label} {...link} />
        {children}
      </div>
      {actions}
    </motion.li>
  );
}
