import { motion } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { EASE, SPRING } from "../lib/motion.ts";
import { useInertToasts } from "./Toast.tsx";

export function Modal({ label, children }: { label: string; children: ReactNode }) {
  useInertToasts();
  useEffect(() => {
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = before;
    };
  }, []);

  return (
    <>
      <motion.div
        className="modal-backdrop"
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.2, ease: EASE.css } }}
        exit={{ opacity: 0, transition: { duration: 0.15, ease: EASE.css } }}
      />
      <div className="modal-scroll">
        <motion.div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-label={label}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0, transition: { ...SPRING.page, opacity: { duration: 0.2, ease: EASE.css } } }}
          exit={{ opacity: 0, y: 12, transition: { duration: 0.15, ease: EASE.css } }}
        >
          {children}
        </motion.div>
      </div>
    </>
  );
}
