import { Field } from "../../public/ui/Field.tsx";
import type { Fixture } from "../fixture.ts";

export default {
  component: Field,
  group: "Inputs",
  props: {
    id: "field-name",
    label: "Name",
    hint: "required",
    error: "Enter a name",
    errorId: "field-name-error",
    input: { placeholder: "Webhook name" },
  },
} satisfies Fixture;
