import { Switch } from "../../public/ui/Switch.tsx";
import type { Fixture } from "../fixture.ts";

export default { component: Switch, group: "Inputs", props: { checked: false, label: "Enabled", disabled: false }, bind: { onChange: "checked" } } satisfies Fixture;
