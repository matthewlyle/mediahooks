import { Check } from "../../public/ui/Check.tsx";
import type { Fixture } from "../fixture.ts";

export default { component: Check, props: { checked: true, children: "Option" } } satisfies Fixture;
