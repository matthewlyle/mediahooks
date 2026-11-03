import { NavLink } from "../../public/ui/NavLink.tsx";
import type { Fixture } from "../fixture.ts";

export default { component: NavLink, props: { to: "/", label: "Webhooks", active: true } } satisfies Fixture;
