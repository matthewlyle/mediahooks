import { StatusMark } from "../../public/ui/StatusBadge.tsx";
import type { Fixture } from "../fixture.ts";

export default { component: StatusMark, group: "Status", props: { status: "success" } } satisfies Fixture;
