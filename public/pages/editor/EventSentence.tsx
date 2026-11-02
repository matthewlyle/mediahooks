import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Fragment,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { createPortal } from "react-dom";
import type { IncomingEvent, PlexLibrary, PlexUser } from "../../../src/types.ts";
import { api } from "../../lib/api.ts";
import { EASE, SPRING, useNarrow } from "../../lib/motion.ts";
import { eventGroups, sentenceParts, type Slot } from "../../lib/sentence.ts";
import "./EventSentence.css";

const csv = (text: string) =>
  text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const WORD_IN = { opacity: 1, transition: { duration: 0.15, ease: EASE.css } } as const;

function Words({ text }: { text: string }) {
  return text.split(" ").map((word, i) => (
    <Fragment key={`${i}-${word}`}>
      <motion.span className="sentence-word" layout="position">
        {word}
      </motion.span>{" "}
    </Fragment>
  ));
}

type TokenProps = {
  text: string;
  full: string;
  label: string;
  suffix?: string;
  tokenRef?: Ref<HTMLSpanElement>;
  invalid?: boolean;
  describedBy?: string;
  popId: string;
  expanded: boolean;
  onOpen: (anchor: HTMLSpanElement) => void;
};

function Token({ text, full, label, suffix, tokenRef, invalid, describedBy, popId, expanded, onOpen }: TokenProps) {
  const words = text.split(" ");
  return (
    <span
      ref={tokenRef}
      role="button"
      tabIndex={0}
      className="sentence-token"
      aria-haspopup="dialog"
      aria-expanded={expanded}
      aria-controls={expanded ? popId : undefined}
      aria-label={`${label}: ${full}`}
      title={full === text ? undefined : full}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onClick={(e) => onOpen(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        onOpen(e.currentTarget);
      }}
    >
      {words.map((word, i) => (
        <Fragment key={`${text}-${i}`}>
          <motion.span className="sentence-word" layout="position" initial={{ opacity: 0 }} animate={WORD_IN}>
            <span className="sentence-token-text">{word}</span>
            {i === words.length - 1 && (
              <>
                <span className="sentence-chevron" aria-hidden="true" />
                {suffix && <span className="sentence-suffix">{suffix}</span>}
              </>
            )}
          </motion.span>
          {i < words.length - 1 && " "}
        </Fragment>
      ))}
    </span>
  );
}

type PopoverProps = {
  id: string;
  open: boolean;
  label: string;
  anchor: HTMLElement | null;
  onClose: (opts: { instant?: boolean; focus?: boolean }) => void;
  children: ReactNode;
};

function Popover({ id, open, label, anchor, onClose, children }: PopoverProps) {
  const reduce = useReducedMotion();
  const sheet = useNarrow();
  const pop = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({});
  const [instant, setInstant] = useState(false);
  const close = useRef(onClose);
  close.current = (opts) => {
    setInstant(Boolean(opts.instant));
    onClose(opts);
  };

  const focusables = () => [...(pop.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input") ?? [])];

  useLayoutEffect(() => {
    if (!open || !pop.current || !anchor) return;
    setInstant(false);
    if (!sheet) {
      const lines = anchor.getClientRects();
      const rect = lines[lines.length - 1] ?? anchor.getBoundingClientRect();
      const width = pop.current.offsetWidth;
      const left = Math.max(12, Math.min(rect.left, document.documentElement.clientWidth - width - 12));
      setStyle({
        top: rect.bottom + 6,
        left,
        maxHeight: Math.max(160, innerHeight - rect.bottom - 18),
        transformOrigin: `${rect.left - left + 12}px 0`,
      });
    }
    focusables()[0]?.focus({ preventScroll: true });
  }, [open, label, anchor, sheet]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element;
      if (pop.current?.contains(target) || target.closest?.(".sentence-token")) return;
      close.current({});
    };
    const onScroll = () => close.current({});
    document.addEventListener("pointerdown", onPointerDown, true);
    // A sheet stays put; resizing is the phone keyboard opening for "Add a name".
    if (!sheet) {
      addEventListener("scroll", onScroll, { passive: true });
      addEventListener("resize", onScroll);
    }
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
    };
  }, [open, sheet]);

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      close.current({ instant: true, focus: true });
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const list = focusables();
    const index = list.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "ArrowDown" ? index + 1 : index - 1;
    list[(next + list.length) % list.length]?.focus();
  }

  const fade = (isInstant: boolean) => ({ opacity: 0, transition: { duration: isInstant ? 0 : 0.1, ease: EASE.css } });
  const motionProps = sheet
    ? {
        initial: reduce ? { opacity: 0 } : { y: "100%" },
        animate: { opacity: 1, y: 0, transition: reduce ? { duration: 0.12 } : SPRING.page },
        variants: {
          exit: (isInstant: boolean) =>
            reduce || isInstant ? fade(isInstant) : { y: "100%", transition: { duration: 0.2, ease: EASE.outQuint } },
        },
      }
    : {
        initial: reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.97 },
        animate: { opacity: 1, y: 0, scale: 1, transition: { duration: reduce ? 0.12 : 0.15, ease: EASE.outQuint } },
        variants: { exit: fade },
      };

  return createPortal(
    <AnimatePresence custom={instant}>
      {open && sheet && (
        <motion.div
          key="scrim"
          className="sheet-scrim"
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.2, ease: EASE.css } }}
          custom={instant}
          variants={{ exit: fade }}
          exit="exit"
        />
      )}
      {open && (
        <motion.div
          key="pop"
          ref={pop}
          id={id}
          role="dialog"
          aria-label={label}
          className={sheet ? "menu sentence-pop sheet" : "menu sentence-pop"}
          style={sheet ? undefined : style}
          custom={instant}
          {...motionProps}
          exit="exit"
          onKeyDown={onKeyDown}
        >
          {sheet && (
            <div className="sheet-head">
              <span>{label}</span>
              <button type="button" className="sheet-done" onClick={() => close.current({ focus: true })}>
                Done
              </button>
            </div>
          )}
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Check({ checked, disabled, onToggle, title, children }: {
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      className="pop-option"
      title={title}
      onClick={() => !disabled && onToggle()}
    >
      <span className="pop-check" aria-hidden="true" />
      {children}
    </button>
  );
}

function AddField({ placeholder, onAdd }: { placeholder: string; onAdd: (value: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <input
      className="pop-add"
      placeholder={placeholder}
      aria-label={placeholder}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const v = value.trim().replace(/,/g, "");
        if (!v) return;
        onAdd(v);
        setValue("");
      }}
    />
  );
}

function NamesPicker({ any, selected, known, placeholder, onChange }: {
  any: string;
  selected: string[];
  known: string[];
  placeholder: string;
  onChange: (names: string[]) => void;
}) {
  const options = [...new Set([...known, ...selected])].sort((a, b) => a.localeCompare(b));
  const has = (n: string) => selected.some((s) => s.toLowerCase() === n.toLowerCase());
  return (
    <>
      <Check checked={selected.length === 0} onToggle={() => onChange([])}>
        {any}
      </Check>
      {options.map((n) => (
        <Check
          key={n}
          checked={has(n)}
          onToggle={() =>
            onChange(has(n) ? selected.filter((s) => s.toLowerCase() !== n.toLowerCase()) : [...selected, n])
          }
        >
          {n}
        </Check>
      ))}
      <AddField placeholder={placeholder} onAdd={(n) => !has(n) && onChange([...selected, n])} />
    </>
  );
}

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

  const labels: Record<Slot, string> = { who: "Users", what: "Events", where: "Libraries" };
  const parts = sentenceParts({ available, allEvents, events, users, libraries }).map((p) => {
    if (p.kind === "words") return <Words key={p.key} text={p.text} />;
    if (p.kind === "space") return <Fragment key={p.key}> </Fragment>;
    return (
      <Token
        key={p.key}
        text={p.text}
        full={p.full}
        label={labels[p.slot]}
        suffix={p.suffix}
        tokenRef={p.first ? setWhatRef : undefined}
        invalid={p.first && invalid}
        describedBy={p.first ? describedBy : undefined}
        popId={popId}
        expanded={open?.kind === p.slot}
        onOpen={toggle(p.slot)}
      />
    );
  });

  return (
    <>
      <p className="sentence">{parts}</p>
      <Popover
        id={popId}
        open={open !== null}
        label={open ? labels[open.kind] : ""}
        anchor={open?.anchor ?? null}
        onClose={onClose}
      >
        {open?.kind === "what" && whatMenu}
        {open?.kind === "who" && (
          <NamesPicker any="anyone" selected={users} known={known.users} placeholder="Add a name" onChange={(n) => props.onUsers(n.join(", "))} />
        )}
        {open?.kind === "where" && (
          <NamesPicker
            any="any library"
            selected={libraries}
            known={known.libraries}
            placeholder="Add a library"
            onChange={(n) => props.onLibraries(n.join(", "))}
          />
        )}
      </Popover>
    </>
  );
}
