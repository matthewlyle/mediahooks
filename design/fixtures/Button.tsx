import { Button } from "../../public/ui/Button.tsx";
import type { Fixture } from "../fixture.ts";

export default { component: Button, group: "Actions", props: { children: "Save", busy: false, spinner: true } } satisfies Fixture;
