import { RelativeTime } from "../../public/ui/RelativeTime.tsx";
import type { Fixture } from "../fixture.ts";

export default { component: RelativeTime, props: { ms: Date.now() - 3 * 60_000 } } satisfies Fixture;
