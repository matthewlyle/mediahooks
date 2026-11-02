import { useSyncExternalStore } from "react";

export const EASE = {
  outQuad: [0.25, 0.46, 0.45, 0.94],
  outQuint: [0.23, 1, 0.32, 1],
  outExpo: [0.19, 1, 0.22, 1],
  inOutCubic: [0.645, 0.045, 0.355, 1],
  css: [0.25, 0.1, 0.25, 1],
} as const;

export const SPRING = {
  page: { type: "spring", visualDuration: 0.35, bounce: 0 },
  morph: { type: "spring", visualDuration: 0.4, bounce: 0 },
  pop: { type: "spring", visualDuration: 0.45, bounce: 0.35 },
  toggle: { type: "spring", visualDuration: 0.3, bounce: 0 },
  press: { type: "spring", visualDuration: 0.25, bounce: 0 },
} as const;

export const TAP = { scale: 0.97, transition: { duration: 0.15, ease: EASE.outQuad } } as const;

export const routeDirection = { current: 0 };

const SLIDE = 32;

export const pageVariants = {
  enter: (dir: number = routeDirection.current) => (dir ? { opacity: 0, x: SLIDE * dir } : { opacity: 1, x: 0 }),
  center: { opacity: 1, x: 0, transition: { x: SPRING.page, opacity: { duration: 0.2, ease: EASE.css } } },
  exit: (dir: number = routeDirection.current) =>
    dir
      ? { opacity: 0, x: -SLIDE * dir, transition: { duration: 0.18, ease: EASE.outQuint } }
      : { opacity: 0, transition: { duration: 0.18, ease: EASE.css } },
};

export const pageTransition = { variants: pageVariants, initial: "enter", animate: "center", exit: "exit" } as const;

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.25, ease: EASE.css } },
} as const;

export const ids = {
  card: (id: number) => `hook-${id}`,
  name: (id: number) => `hook-name-${id}`,
  url: (id: number) => `hook-url-${id}`,
  nav: "nav-indicator",
} as const;

const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
export const reduced = (): boolean => reducedQuery.matches;

function useMediaQuery(query: MediaQueryList): boolean {
  return useSyncExternalStore(
    (onChange) => {
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => query.matches,
  );
}

const finePointerQuery = matchMedia("(hover: hover) and (pointer: fine)");
export const useFinePointer = (): boolean => useMediaQuery(finePointerQuery);

const narrowQuery = matchMedia("(max-width: 640px)");
export const useNarrow = (): boolean => useMediaQuery(narrowQuery);

export function flash(el: HTMLElement | null | undefined, tone: "accent" | "error" = "accent"): void {
  if (!el) return;
  delete el.dataset.flash;
  void el.offsetWidth; // restart the animation if it's already running
  el.dataset.flash = tone;
  const done = (event: AnimationEvent) => {
    if (event.target !== el) return;
    el.removeEventListener("animationend", done);
    delete el.dataset.flash;
  };
  el.addEventListener("animationend", done);
}
