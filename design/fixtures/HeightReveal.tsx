import { AnimatePresence } from "motion/react";
import { useState } from "react";
import { HeightReveal, type HeightRevealProps } from "../../public/ui/HeightReveal.tsx";
import type { Fixture } from "../fixture.ts";

function HeightRevealDemo({ presence, children, ...props }: HeightRevealProps) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ width: 360 }}>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Show less" : "Show more"}
      </button>
      {presence ? (
        <AnimatePresence initial={false}>{open && <HeightReveal key="content" presence {...props}>{children}</HeightReveal>}</AnimatePresence>
      ) : (
        <HeightReveal {...props}>
          <p>{children}</p>
          {open && <p>More content appears here, and the wrapper follows its height.</p>}
        </HeightReveal>
      )}
    </div>
  );
}

export default {
  component: HeightRevealDemo,
  props: { children: "Content that opens and closes with a height and opacity animation.", presence: false, animated: true, className: "", innerClassName: "" },
} satisfies Fixture;
