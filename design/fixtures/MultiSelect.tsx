import { useState } from "react";
import { MultiSelect, type MultiSelectProps } from "../../public/ui/MultiSelect.tsx";
import { Popover } from "../../public/ui/Popover.tsx";
import type { Fixture } from "../fixture.ts";

function MultiSelectDemo(props: MultiSelectProps) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(true);
  return (
    <div style={{ minHeight: 280 }}>
      <button type="button" ref={setAnchor} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Names
      </button>
      <Popover id="demo-multi-select" open={open} label="Names" anchor={anchor} onClose={() => setOpen(false)}>
        <MultiSelect {...props} />
      </Popover>
    </div>
  );
}

export default {
  component: MultiSelectDemo,
  group: "Inputs",
  props: { any: "anyone", selected: ["Alice"], known: ["Alice", "Bob", "Carol"], placeholder: "Add a name" },
  bind: { onChange: (names: string[]) => ({ selected: names }) },
} satisfies Fixture;
