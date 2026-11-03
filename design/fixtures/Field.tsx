import { Field } from "../../public/ui/Field.tsx";
import type { Fixture } from "../fixture.ts";

export default {
  component: Field,
  props: {
    id: "field-name",
    label: "Name",
    hint: "required",
    error: "Enter a name",
    errorId: "field-name-error",
    input: { placeholder: "Webhook name" },
  },
} satisfies Fixture;
