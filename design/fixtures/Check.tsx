import { Check } from "../../public/ui/Check.tsx";
import type { Fixture } from "../fixture.ts";

export default { component: Check, group: "Inputs", props: { checked: true, children: "Option" } } satisfies Fixture;
