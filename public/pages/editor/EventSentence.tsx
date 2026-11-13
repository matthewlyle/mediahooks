import { Fragment, useEffect, useId, useRef, useState, type ReactNode, type Ref } from "react";
import type { IncomingEvent, PlexLibrary, PlexUser } from "../../../src/types.ts";
import { api } from "../../lib/api.ts";
import { eventGroups, sentenceParts, type Slot } from "../../lib/sentence.ts";
import { Check } from "../../ui/Check.tsx";
import { MultiSelect } from "../../ui/MultiSelect.tsx";
import { Popover } from "../../ui/Popover.tsx";
import { Sentence } from "../../ui/Sentence.tsx";

const csv = (text: string) =>
  text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export type EventSentenceProps = {
  available: string[];
  allEvents: boolean;
  events: string[];
  users: string;
  libraries: string;
  onAllEvents: (on: boolean) => void;
  onToggle: (id: string) => void;
  onUsers: (csv: string) => void;
  onLibraries: (csv: string) => void;
  whatRef: Ref<HTMLSpanElement>;
  invalid: boolean;
  describedBy?: string;
};

type Names = { users: string[]; libraries: string[] };

async function seenInEvents(): Promise<Names> {
  const res = await api<IncomingEvent[]>("/api/events");
  const users = new Set<string>();
  const libraries = new Set<string>();
  for (const e of res.ok ? res.data : []) {
    if (e.payload.Account?.title) users.add(e.payload.Account.title);
    if (e.payload.Metadata?.librarySectionTitle) libraries.add(e.payload.Metadata.librarySectionTitle);
  }
  return { users: [...users], libraries: [...libraries] };
}

async function knownNames(): Promise<Names> {
  const [users, libraries] = await Promise.all([
    api<PlexUser[]>("/api/plex/users"),
    api<PlexLibrary[]>("/api/plex/libraries"),
  ]);
  const seen = users.ok && libraries.ok ? null : await seenInEvents();
  return {
    users: users.ok ? users.data.map((u) => u.title) : seen!.users,
    libraries: libraries.ok ? libraries.data.map((l) => l.title) : seen!.libraries,
  };
}

export function EventSentence(props: EventSentenceProps) {
  const { available, allEvents, events, onAllEvents, onToggle, whatRef, invalid, describedBy } = props;
  const [known, setKnown] = useState<Names>({ users: [], libraries: [] });

  useEffect(() => {
    let live = true;
    void knownNames().then((names) => live && setKnown(names));
    return () => {
      live = false;
    };
  }, []);

  const users = csv(props.users);
  const libraries = csv(props.libraries);
  const groups = eventGroups(available);

  const whatMenu = (
    <>
      <Check checked={allEvents} onToggle={() => onAllEvents(!allEvents)}>
        anything happens
      </Check>
      {groups.map(
        (g) =>
          g.options.length > 0 && (
            <div key={g.name} role="group" aria-label={g.name}>
              <div className="pop-heading" aria-hidden="true">
                {g.name}
              </div>
              {g.options.map(([id, phrase]) => (
                <Check key={id} title={id} checked={allEvents || events.includes(id)} disabled={allEvents} onToggle={() => onToggle(id)}>
                  {phrase}
                </Check>
              ))}
            </div>
          ),
      )}
    </>
  );
  const labels: Record<Slot, string> = { who: "Users", what: "Events", where: "Libraries" };
  const popId = useId();
  const [open, setOpen] = useState<{ kind: Slot; anchor: HTMLElement } | null>(null);
  const whatEl = useRef<HTMLSpanElement | null>(null);
  const toggle = (kind: Slot) => (anchor: HTMLSpanElement) =>
    setOpen((o) => (o?.kind === kind && o.anchor === anchor ? null : { kind, anchor }));
  function onClose({ focus }: { focus?: boolean }) {
    const anchor = open?.anchor;
    setOpen(null);
    if (focus) (anchor?.isConnected ? anchor : whatEl.current)?.focus({ preventScroll: true });
  }
  function setWhatRef(el: HTMLSpanElement | null) {
    whatEl.current = el;
    if (typeof whatRef === "function") whatRef(el);
    else if (whatRef) whatRef.current = el;
  }

  return (
    <>
      <Sentence
        parts={sentenceParts({ available, allEvents, events, users, libraries })}
        labels={labels}
        openSlot={open?.kind ?? null}
        popupId={popId}
        invalid={invalid}
        describedBy={describedBy}
        firstRef={setWhatRef}
        onOpen={(slot, anchor) => toggle(slot)(anchor)}
      />
      <Popover
        id={popId}
        open={open !== null}
        label={open ? labels[open.kind] : ""}
        anchor={open?.anchor ?? null}
        onClose={onClose}
      >
        {open?.kind === "what" && whatMenu}
        {open?.kind === "who" && (
          <MultiSelect any="anyone" selected={users} known={known.users} onChange={(n) => props.onUsers(n.join(", "))} />
        )}
        {open?.kind === "where" && (
          <MultiSelect
            any="any library"
            selected={libraries}
            known={known.libraries}
            onChange={(n) => props.onLibraries(n.join(", "))}
          />
        )}
      </Popover>
    </>
  );
}
