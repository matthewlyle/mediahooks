import { useLayoutEffect, useRef, useState } from "react";
import { Check } from "../../public/ui/Check.tsx";
import { MultiSelect } from "../../public/ui/MultiSelect.tsx";
import { Popover } from "../../public/ui/Popover.tsx";
import { Sentence, type SentenceProps } from "../../public/ui/Sentence.tsx";
import { eventGroups, type Part, type Slot } from "../../public/lib/sentence.ts";
import "../../public/pages/editor/EventSentence.css";
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

const available = ["media.play", "media.pause", "media.stop", "library.new", "admin.database.backup"];
const groups = eventGroups(available);

function SentenceDemo({ openSlot, onOpen, ...props }: SentenceProps) {
  const stage = useRef<HTMLDivElement>(null);
  const labels = props.labels ?? { who: "Users", what: "Events", where: "Libraries" };
  const [open, setOpen] = useState<{ slot: Slot; anchor: HTMLElement } | null>(null);
  const [users, setUsers] = useState(["Matt"]);
  const [libraries, setLibraries] = useState<string[]>([]);
  const [events, setEvents] = useState(["media.play", "media.pause"]);

  useLayoutEffect(() => {
    if (!openSlot) return setOpen(null);
    const anchor = stage.current?.querySelector<HTMLElement>(`[aria-label^="${labels[openSlot]}:"]`);
    setOpen(anchor ? { slot: openSlot, anchor } : null);
  }, [openSlot]);

  return (
    <div ref={stage} style={{ minHeight: 320 }}>
      <Sentence
        {...props}
        labels={labels}
        openSlot={open?.slot ?? null}
        popupId={props.popupId}
        onOpen={(slot, anchor) => {
          setOpen((o) => (o?.slot === slot ? null : { slot, anchor }));
          onOpen?.(slot, anchor);
        }}
      />
      <Popover
        id={props.popupId ?? "demo-sentence-popover"}
        open={open !== null}
        label={open ? labels[open.slot] : ""}
        anchor={open?.anchor ?? null}
        onClose={() => setOpen(null)}
      >
        {open?.slot === "what" &&
          groups.map((g) => (
            <div key={g.name} role="group" aria-label={g.name}>
              <div className="pop-heading" aria-hidden="true">
                {g.name}
              </div>
              {g.options.map(([id, phrase]) => (
                <Check
                  key={id}
                  checked={events.includes(id)}
                  onToggle={() => setEvents((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]))}
                >
                  {phrase}
                </Check>
              ))}
            </div>
          ))}
        {open?.slot === "who" && (
          <MultiSelect any="anyone" selected={users} known={["Alice", "Bob", "Matt"]} placeholder="Add a name" onChange={setUsers} />
        )}
        {open?.slot === "where" && (
          <MultiSelect
            any="any library"
            selected={libraries}
            known={["Movies", "TV Shows"]}
            placeholder="Add a library"
            onChange={setLibraries}
          />
        )}
      </Popover>
    </div>
  );
}

export default {
  component: SentenceDemo,
  props: {
    parts,
    labels: { who: "Users", what: "Events", where: "Libraries" },
    openSlot: "who",
    popupId: "demo-sentence-popover",
  },
  bind: { onOpen: (slot: string) => ({ openSlot: slot }) },
} satisfies Fixture;
