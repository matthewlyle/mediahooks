import { ResultLine } from "../../public/ui/ResultLine.tsx";
import type { Fixture } from "../fixture.ts";

export default { component: ResultLine, props: { ok: true, status: 200, durationMs: 120, error: "Connection refused" } } satisfies Fixture;
