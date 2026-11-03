import { Field, FieldInput } from "../../public/ui/Field.tsx";
import type { Fixture } from "../fixture.ts";

export default {
  component: Field,
  props: {
    id: "field-name",
    label: "Name",
    hint: "required",
    error: "Enter a name",
    errorId: "field-name-error",
    children: <FieldInput id="field-name" />,
  },
} satisfies Fixture;
