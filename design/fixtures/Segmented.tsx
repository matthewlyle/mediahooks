import { Segmented } from "../../public/ui/Segmented.tsx";
import type { Fixture } from "../fixture.ts";

export default {
  component: Segmented,
  group: "Navigation",
  props: {
    label: "Preview with",
    options: [
      ["episode", "Episode"],
      ["movie", "Movie"],
      ["track", "Music"],
    ],
    value: "episode",
  },
  bind: { onChange: "value" },
} satisfies Fixture;
