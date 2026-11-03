import { useSyncExternalStore } from "react";

/** Cubic-bezier easings as control points: outQuad, outQuint, outExpo, inOutCubic and css (the CSS `ease` curve). */
export const EASE = {
  outQuad: [0.25, 0.46, 0.45, 0.94],
  outQuint: [0.23, 1, 0.32, 1],
  outExpo: [0.19, 1, 0.22, 1],
  inOutCubic: [0.645, 0.045, 0.355, 1],
  css: [0.25, 0.1, 0.25, 1],
} as const;

/** Spring transitions by role: page, morph, pop (bouncy, for success), toggle and press. */
export const SPRING = {
  page: { type: "spring", visualDuration: 0.35, bounce: 0 },
  morph: { type: "spring", visualDuration: 0.4, bounce: 0 },
  pop: { type: "spring", visualDuration: 0.45, bounce: 0.35 },
  toggle: { type: "spring", visualDuration: 0.3, bounce: 0 },
  press: { type: "spring", visualDuration: 0.25, bounce: 0 },
} as const;

/** Press feedback for buttons: shrinks to 97% over 150ms. */
export const TAP = { scale: 0.97, transition: { duration: 0.15, ease: EASE.outQuad } } as const;

/** Direction of the current navigation: 1 forward, -1 back, 0 none. */
export const routeDirection = { current: 0 };

const SLIDE = 32;

/** Slide-and-fade between routes, direction taken from `routeDirection`. */
export const pageVariants = {
  enter: (dir: number = routeDirection.current) => (dir ? { opacity: 0, x: SLIDE * dir } : { opacity: 1, x: 0 }),
  center: { opacity: 1, x: 0, transition: { x: SPRING.page, opacity: { duration: 0.2, ease: EASE.css } } },
  exit: (dir: number = routeDirection.current) =>
    dir
      ? { opacity: 0, x: -SLIDE * dir, transition: { duration: 0.18, ease: EASE.outQuint } }
      : { opacity: 0, transition: { duration: 0.18, ease: EASE.css } },
};

/** Spread onto a `motion` element to animate it as a routed page. */
export const pageTransition = { variants: pageVariants, initial: "enter", animate: "center", exit: "exit" } as const;

/** Opacity-only entrance for content that doesn't slide. */
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.25, ease: EASE.css } },
} as const;

/** Shared-element `layoutId`s, so a card, its name and URL, and the nav indicator morph between pages. */
export const ids = {
  card: (id: number) => `hook-${id}`,
  name: (id: number) => `hook-name-${id}`,
  url: (id: number) => `hook-url-${id}`,
  nav: "nav-indicator",
} as const;

const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
/** True when the user prefers reduced motion. */
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
/** True when the primary pointer is a mouse or trackpad that can hover. */
export const useFinePointer = (): boolean => useMediaQuery(finePointerQuery);

const narrowQuery = matchMedia("(max-width: 640px)");
/** True under 640px wide, where popovers become bottom sheets. */
export const useNarrow = (): boolean => useMediaQuery(narrowQuery);

/** Restarts a one-shot flash animation on an element: accent for success, error for failure. */
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
