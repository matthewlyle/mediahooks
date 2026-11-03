import { LinkButton } from "../../public/ui/Button.tsx";
import type { Fixture } from "../fixture.ts";

export default { component: LinkButton, group: "Actions", props: { to: "/", children: "Back" } } satisfies Fixture;
