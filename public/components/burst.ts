import { animate } from "motion/react";
import { EASE, reduced } from "../lib/motion.ts";

const CONFETTI_COUNT = 14;

export function burst(origin: HTMLElement | null | undefined): void {
  if (!origin || reduced()) return;
  const rect = origin.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  for (let i = 0; i < CONFETTI_COUNT; i++) {
    const dot = document.createElement("span");
    dot.className = "confetti";
    dot.style.left = `${cx - 3}px`;
    dot.style.top = `${cy - 3}px`;
    document.body.append(dot);

    const angle = (i / CONFETTI_COUNT) * 2 * Math.PI + (Math.random() - 0.5) * 0.4;
    const distance = 48 + Math.random() * 48;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    const rotation = Math.random() * 360;
    const moved = animate(
      dot,
      {
        transform: [
          "translate(0px, 0px) scale(1) rotate(0deg)",
          `translate(${dx}px, ${dy}px) scale(0.3) rotate(${rotation}deg)`,
        ],
      },
      { duration: 0.7, ease: EASE.outExpo },
    );
    const faded = animate(dot, { opacity: [1, 1, 0] }, { duration: 0.7, times: [0, 0.6, 1], ease: "linear" });
    Promise.all([moved, faded]).then(() => dot.remove());
  }
}
