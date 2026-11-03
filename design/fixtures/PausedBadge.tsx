import { PausedBadge } from "../../public/ui/PausedBadge.tsx";
import type { Fixture } from "../fixture.ts";

export default { component: PausedBadge, group: "Status", props: { paused: true } } satisfies Fixture;
