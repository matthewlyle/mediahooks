import { motion, useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { EASE } from "../lib/motion.ts";
import "./Reveal.css";

const HEIGHT_EASE = [0.25, 1, 0.5, 1] as const;

/** Content that grows from zero height and fades in on mount and collapses on exit; render it inside AnimatePresence. */
export function Reveal({ children }: {
  /** Content to disclose. Its measured height drives the animation. */
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [settled, setSettled] = useState(false);

  useLayoutEffect(() => {
    const el = inner.current!;
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      className={settled ? "reveal settled" : "reveal"}
      onAnimationStart={() => setSettled(false)}
      onAnimationComplete={() => setSettled(true)}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: height ?? "auto", opacity: 1 }}
      exit={{
        height: 0,
        opacity: 0,
        transition: {
          height: reduce ? { duration: 0 } : { duration: 0.2, ease: EASE.outQuint },
          opacity: { duration: 0.12, ease: EASE.css },
        },
      }}
      transition={{
        height: reduce ? { duration: 0 } : { duration: 0.27, ease: HEIGHT_EASE },
        opacity: { duration: 0.2, ease: EASE.css, delay: reduce ? 0 : 0.05 },
      }}
    >
      <div ref={inner} className="reveal-inner">
        {children}
      </div>
    </motion.div>
  );
}
