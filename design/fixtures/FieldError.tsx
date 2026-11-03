import { FieldError } from "../../public/ui/FieldError.tsx";
import type { Fixture } from "../fixture.ts";

export default { component: FieldError, props: { id: "field-error", error: "Enter a name" } } satisfies Fixture;
