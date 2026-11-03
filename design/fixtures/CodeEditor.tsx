import { CodeEditor } from "../../public/ui/CodeEditor.tsx";
import type { Fixture } from "../fixture.ts";

export default {
  component: CodeEditor,
  props: {
    value: '{\n  "content": "{{user}} {{action}} {{display_title}}"\n}',
    language: "json",
    ariaLabel: "Body",
    placeholder: "Type {{ to insert a variable",
    completions: {
      vars: { user: "Matt", action: "played", display_title: "Severance" },
      payload: { Metadata: { title: "Severance", year: 2022 } },
    },
  },
  bind: { onChange: "value" },
} satisfies Fixture;
