import { CodeBlock } from "../../public/ui/CodeBlock.tsx";
import type { Fixture } from "../fixture.ts";

export default {
  component: CodeBlock,
  props: { inset: true, label: "Payload", head: "POST https://example.com/hook\ncontent-type: application/json\n\n", children: '{\n  "event": "media.play"\n}' },
} satisfies Fixture;
