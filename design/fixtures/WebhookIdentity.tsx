import { WebhookIdentity } from "../../public/ui/WebhookIdentity.tsx";
import type { Part } from "../../public/lib/sentence.ts";
import type { Fixture } from "../fixture.ts";

const parts: Part[] = [
  { kind: "words", key: "send", text: "Send when" },
  { kind: "token", key: "who", slot: "who", text: "Matt", full: "Matt", suffix: "", first: false },
  { kind: "space", key: "s1" },
  { kind: "token", key: "what", slot: "what", text: "starts or pauses", full: "starts or pauses", suffix: "", first: true },
  { kind: "space", key: "s2" },
  { kind: "words", key: "tail", text: "something in" },
  { kind: "token", key: "where", slot: "where", text: "any library", full: "any library", suffix: ".", first: false },
];

export default {
  component: WebhookIdentity,
  group: "Data",
  props: {
    id: 1,
    name: "Discord notifications",
    url: "https://discord.com/api/webhooks/123/abc",
    paused: false,
    parts,
    variant: "card",
  },
} satisfies Fixture;
