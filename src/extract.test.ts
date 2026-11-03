import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { extract } from "../design/extract";

function fixture() {
  const dir = mkdtempSync(join(import.meta.dir, "..", "design", ".fixture-"));
  const ui = join(dir, "public", "ui");
  mkdirSync(ui, { recursive: true });
  writeFileSync(
    join(ui, "button.tsx"),
    `import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { motion, type HTMLMotionProps } from "motion/react";
type Props = {
  /** Visual weight. */
  variant?: "primary" | "quiet" | "danger";
  /** Shown instead of children. */
  label: string;
} & ComponentPropsWithoutRef<"button">;
/** A pressable button. */
export const Button = forwardRef<HTMLButtonElement, Props>(function Button({ variant = "primary", label, ...rest }, ref) {
  return <button ref={ref} {...rest}>{label}</button>;
});
export function Chip({ tone = "plain" }: {
  /** Colour. */
  tone?: "plain" | "loud";
}) {
  return <span>{tone}</span>;
}
export const helper = 1;
`,
  );
  writeFileSync(
    join(ui, "tokens.css"),
    `:root {
  /* Page background */
  --bg: #111;
  --gap: 8px; /* Base spacing */
  --plain: 1px;
}
`,
  );
  writeFileSync(
    join(dir, "motion.ts"),
    `/** Easing curves. */
export const EASE = { out: [0, 0, 1, 1] } as const;
const hidden = 1;
export const TAP = { scale: 0.97 };
`,
  );
  return { dir, sources: { uiDir: ui, tokensCss: join(ui, "tokens.css"), motionTs: join(dir, "motion.ts") } };
}

test("extracts components, tokens and motion exports from source", () => {
  const { dir, sources } = fixture();
  const out = extract(sources);
  rmSync(dir, { recursive: true });
  expect(out.components.map((c) => c.name)).toEqual(["Button", "Chip"]);
  const [button, chip] = out.components;
  expect(button!.doc).toBe("A pressable button.");
  expect(button!.props).toEqual([
    { name: "variant", type: '"primary" | "quiet" | "danger"', required: false, options: ["primary", "quiet", "danger"], default: '"primary"', doc: "Visual weight." },
    { name: "label", type: "string", required: true, doc: "Shown instead of children." },
  ]);
  expect(button!.inherits).toEqual(["<button>"]);
  expect(chip!.props[0]).toMatchObject({ name: "tone", options: ["plain", "loud"], default: '"plain"', doc: "Colour." });
  expect(chip!.inherits).toEqual([]);
  expect(out.cssTokens).toEqual([
    { name: "--bg", value: "#111", doc: "Page background" },
    { name: "--gap", value: "8px", doc: "Base spacing" },
    { name: "--plain", value: "1px" },
  ]);
  expect(out.motionTokens).toEqual([
    { name: "EASE", value: "{ out: [0, 0, 1, 1] }", doc: "Easing curves." },
    { name: "TAP", value: "{ scale: 0.97 }" },
  ]);
});

test("reads the repo's motion.ts", () => {
  const out = extract();
  expect(out.motionTokens.map((t) => t.name)).toContain("SPRING");
});
