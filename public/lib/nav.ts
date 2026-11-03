import { MotionGlobalConfig, useIsPresent } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useRef, type MouseEvent, type RefObject } from "react";
import { useLocation } from "wouter";

export type NavigateOptions = {
  instant?: boolean;
  replace?: boolean;
};
export type Navigate = (to: string, opts?: NavigateOptions) => void;

let resetTimer: ReturnType<typeof setTimeout> | undefined;

function skipAnimationsBriefly(): void {
  MotionGlobalConfig.skipAnimations = true;
  clearTimeout(resetTimer);
  resetTimer = setTimeout(() => {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        MotionGlobalConfig.skipAnimations = false;
      }),
    );
  }, 0);
}

export function useNav(): Navigate {
  const [, setLocation] = useLocation();
  return useCallback<Navigate>(
    (to, opts = {}) => {
      if (opts.instant) skipAnimationsBriefly();
      setLocation(to, { replace: opts.replace });
    },
    [setLocation],
  );
}

export function useLinkProps(to: string, opts?: NavigateOptions): { href: string; onClick: (e: MouseEvent) => void } {
  const navigate = useNav();
  return {
    href: to,
    onClick: (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      navigate(to, opts);
    },
  };
}

export function useEscape(onEscape: () => void): void {
  const present = useIsPresent();
  const handler = useRef(onEscape);
  handler.current = onEscape;
  useEffect(() => {
    if (!present) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      handler.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [present]);
}

export const PendingHeadingFocus = createContext<RefObject<boolean>>({ current: false });

export function useRouteHeading<T extends HTMLElement>(enabled = true) {
  const pending = useContext(PendingHeadingFocus);
  return useCallback(
    (el: T | null) => {
      if (!el || !enabled || !pending.current) return;
      pending.current = false;
      el.focus({ preventScroll: true });
    },
    [pending, enabled],
  );
}
