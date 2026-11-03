import { LiveRegion } from "../../public/ui/LiveRegion.tsx";
import type { Fixture } from "../fixture.ts";

export default { component: LiveRegion, group: "Status", props: { children: "Saved", politeness: "polite", visible: true } } satisfies Fixture;
