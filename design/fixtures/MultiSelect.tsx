import { MultiSelect } from "../../public/ui/MultiSelect.tsx";
import type { Fixture } from "../fixture.ts";

export default {
  component: MultiSelect,
  props: { any: "anyone", selected: ["Alice"], known: ["Alice", "Bob", "Carol"], placeholder: "Add a name" },
  bind: { onChange: (names: string[]) => ({ selected: names }) },
} satisfies Fixture;
