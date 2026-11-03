import { Select } from "../../public/ui/Select.tsx";
import type { Fixture } from "../fixture.ts";

export default {
  component: Select,
  props: {
    label: "Template",
    options: [
      ["custom", "Custom"],
      ["plex", "Plex"],
      ["discord", "Discord"],
    ],
    value: "custom",
  },
  bind: { onChange: (e: { target: { value: string } }) => ({ value: e.target.value }) },
} satisfies Fixture;
