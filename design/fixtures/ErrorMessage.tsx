import { ErrorMessage } from "../../public/ui/ErrorMessage.tsx";
import type { Fixture } from "../fixture.ts";

export default { component: ErrorMessage, props: { children: "connect ECONNREFUSED 127.0.0.1:9000" } } satisfies Fixture;
