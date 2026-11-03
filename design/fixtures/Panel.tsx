import { Panel } from "../../public/ui/Panel.tsx";
import type { Fixture } from "../fixture.ts";

export default { component: Panel, group: "Layout", props: { children: "Panel content", dense: false } } satisfies Fixture;
