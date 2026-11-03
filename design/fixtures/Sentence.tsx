import { Sentence } from "../../public/ui/Sentence.tsx";
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
  component: Sentence,
  props: {
    parts,
    labels: { who: "Users", what: "Events", where: "Libraries" },
    openSlot: null,
    popupId: "demo-sentence-popover",
  },
  bind: { onOpen: (slot: string) => ({ openSlot: slot }) },
} satisfies Fixture;
