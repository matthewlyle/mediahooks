import { LinkButton } from "../../public/ui/Button.tsx";
import type { Fixture } from "../fixture.ts";

export default { component: LinkButton, props: { to: "/", children: "Back" } } satisfies Fixture;
