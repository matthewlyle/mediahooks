import { Avatar } from "../../public/ui/Avatar.tsx";
import type { Fixture } from "../fixture.ts";

export default {
  component: Avatar,
  props: {
    label: "Signed in as matt",
    name: "matt",
    items: [{ label: "Sign out", onSelect: () => {} }],
  },
} satisfies Fixture;
