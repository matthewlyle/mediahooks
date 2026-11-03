import { AnimatePresence } from "motion/react";
import { useState } from "react";
import { HeightReveal, type HeightRevealProps } from "../../public/ui/HeightReveal.tsx";
import type { Fixture } from "../fixture.ts";

function HeightRevealDemo({ presence, children, animated }: Pick<HeightRevealProps, "children" | "presence" | "animated">) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ width: 360 }}>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Show less" : "Show more"}
      </button>
      {presence ? (
        <AnimatePresence initial={false}>{open && <HeightReveal key="content" presence animated={animated}>{children}</HeightReveal>}</AnimatePresence>
      ) : (
        <HeightReveal animated={animated}>
          <p>{children}</p>
          {open && <p>More content appears here, and the wrapper follows its height.</p>}
        </HeightReveal>
      )}
    </div>
  );
}

export default {
  component: HeightRevealDemo,
  group: "Layout",
  props: { children: "Content that opens and closes with a height and opacity animation.", presence: false, animated: true },
} satisfies Fixture;
