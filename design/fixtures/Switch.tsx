import { Switch } from "../../public/ui/Switch.tsx";
import type { Fixture } from "../fixture.ts";

export default { component: Switch, props: { checked: false, label: "Enabled" }, bind: { onChange: "checked" } } satisfies Fixture;
