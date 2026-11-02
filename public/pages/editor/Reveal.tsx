import { motion, useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { EASE } from "../../lib/motion.ts";

const HEIGHT_EASE = [0.25, 1, 0.5, 1] as const;

export function Reveal({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = inner.current!;
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      className="reveal"
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
