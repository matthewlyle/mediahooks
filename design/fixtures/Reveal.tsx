import { AnimatePresence } from "motion/react";
import { createElement, Fragment, useState, type ReactNode } from "react";
import { Reveal } from "../../public/ui/Reveal.tsx";
import type { Fixture } from "../fixture.ts";

function RevealDemo({ children }: { children: ReactNode }) {
  const [show, setShow] = useState(true);
  return createElement(
    Fragment,
    null,
    createElement("button", { type: "button", "aria-expanded": show, onClick: () => setShow(!show) }, show ? "Hide" : "Show"),
    createElement(AnimatePresence, { initial: false }, show ? createElement(Reveal, { key: "content", children }) : null),
  );
}

export default { component: RevealDemo, props: { children: "Content that opens and closes with a height and opacity animation." } } satisfies Fixture;
