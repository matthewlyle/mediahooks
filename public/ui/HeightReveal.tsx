import { motion, useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { EASE, SPRING } from "../lib/motion.ts";

const HEIGHT_IN = { duration: 0.3, ease: [0.25, 1, 0.5, 1] } as const;
const HEIGHT_OUT = { duration: 0.2, ease: EASE.outQuint } as const;
const FADE_IN = { duration: 0.2, ease: EASE.css } as const;

/** Fade-out timing for a row or detail panel leaving the table. */
export const FADE_OUT = { duration: 0.12, ease: EASE.css } as const;

/** Tracks the rendered height of an element, for animating a container to fit its content. */
export function useHeight<T extends HTMLElement>(): [RefObject<T | null>, number | null] {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry?.borderBoxSize[0];
      if (box) setHeight(box.blockSize);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, height];
}

export type HeightRevealProps = {
  /** Content whose height the wrapper follows. */
  children?: ReactNode;
  /** Class names on the outer element, for layout in the parent. */
  className?: string;
  /** Class names on the element that wraps the content and is measured. */
  innerClassName?: string;
  /** Id on the outer element. */
  id?: string;
  /** Opens from zero height and fades in on mount, and shrinks and fades out on unmount inside `AnimatePresence`. */
  presence?: boolean;
  /** Whether height changes animate; reduced motion turns it off regardless. */
  animated?: boolean;
};

/** A wrapper whose height animates to fit its content as the content changes, or as it mounts and unmounts. */
export function HeightReveal({ children, className, innerClassName, id, presence = false, animated = true }: HeightRevealProps) {
  const reduce = useReducedMotion();
  const [inner, height] = useHeight<HTMLDivElement>();
  const content = (
    <div ref={inner} className={innerClassName}>
      {children}
    </div>
  );

  if (!presence) {
    return (
      <motion.div
        id={id}
        className={className}
        initial={false}
        animate={{ height: height ?? "auto" }}
        transition={animated && !reduce ? SPRING.morph : { duration: 0 }}
      >
        {content}
      </motion.div>
    );
  }

  return (
    <motion.div
      id={id}
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, height: height ?? 0 }}
      exit={
        reduce
          ? { opacity: 0, transition: FADE_OUT }
          : { opacity: 0, height: 0, transition: { height: HEIGHT_OUT, opacity: FADE_OUT } }
      }
      transition={{ height: HEIGHT_IN, opacity: FADE_IN }}
    >
      {content}
    </motion.div>
  );
}
