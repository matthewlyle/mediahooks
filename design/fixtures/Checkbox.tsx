import { Checkbox } from "../../public/ui/Checkbox.tsx";
import type { Fixture } from "../fixture.ts";

export default {
  component: Checkbox,
  props: { checked: false, label: "Attach poster", hint: "sent as a file, Discord's format" },
  bind: { onChange: "checked" },
} satisfies Fixture;
