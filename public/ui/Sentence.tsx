import { motion } from "motion/react";
import { Fragment, type Ref } from "react";
import { EASE } from "../lib/motion.ts";
import type { Part, Slot } from "../lib/sentence.ts";
import "./Sentence.css";

const WORD_IN = { opacity: 1, transition: { duration: 0.15, ease: EASE.css } } as const;

export type SentenceProps = {
  /** The words, spaces and value tokens that make up the sentence, in order. */
  parts: Part[];
  /** Extra class on the paragraph, for the surrounding layout and type size. */
  className?: string;
  /** Colors the value tokens with the foreground color instead of inheriting it. Only applies to a read-only sentence. */
  highlight?: boolean;
  /** Makes the value tokens buttons that call onOpen. Without it the sentence is plain text. */
  onOpen?: (slot: Slot, anchor: HTMLSpanElement) => void;
  /** Names each slot for assistive tech, as in "Users: anyone". Used by editable tokens. */
  labels?: Record<Slot, string>;
  /** The slot whose popover is open, which marks its tokens as expanded. */
  openSlot?: Slot | null;
  /** Id of the popover the tokens control while it is open. */
  popupId?: string;
  /** Marks the first token as invalid and tints it red. */
  invalid?: boolean;
  /** Id of the element that describes the first token, such as its error message. */
  describedBy?: string;
  /** Receives the first token's element, so focus can return to it. */
  firstRef?: Ref<HTMLSpanElement>;
};

/** A webhook written out as a sentence, either as plain text or with value tokens that open a picker. */
export function Sentence({
  parts,
  className,
  highlight,
  onOpen,
  labels,
  openSlot,
  popupId,
  invalid,
  describedBy,
  firstRef,
}: SentenceProps) {
  if (!onOpen) {
    return (
      <p className={["sentence", className].filter(Boolean).join(" ")}>
        {parts.map((p) => (
          <Fragment key={p.key}>
            {p.kind === "words" && `${p.text} `}
            {p.kind === "space" && " "}
            {p.kind === "token" && (
              <>
                <span className={highlight ? "sentence-value" : undefined}>{p.full}</span>
                {p.suffix}
              </>
            )}
          </Fragment>
        ))}
      </p>
    );
  }
  return (
    <p className={["sentence", "sentence-editable", className].filter(Boolean).join(" ")}>
      {parts.map((p) => {
        if (p.kind === "space") return <Fragment key={p.key}> </Fragment>;
        if (p.kind === "words") {
          return p.text.split(" ").map((word, i) => (
            <Fragment key={`${p.key}-${i}-${word}`}>
              <motion.span className="sentence-word" layout="position">
                {word}
              </motion.span>{" "}
            </Fragment>
          ));
        }
        const words = p.text.split(" ");
        const open = (el: HTMLSpanElement) => onOpen(p.slot, el);
        return (
          <span
            key={p.key}
            ref={p.first ? firstRef : undefined}
            role="button"
            tabIndex={0}
            className="sentence-token"
            aria-haspopup="dialog"
            aria-expanded={openSlot === p.slot}
            aria-controls={openSlot === p.slot ? popupId : undefined}
            aria-label={`${labels?.[p.slot] ?? p.slot}: ${p.full}`}
            title={p.full === p.text ? undefined : p.full}
            aria-invalid={(p.first && invalid) || undefined}
            aria-describedby={p.first ? describedBy : undefined}
            onClick={(e) => open(e.currentTarget)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              open(e.currentTarget);
            }}
          >
            {words.map((word, i) => (
              <Fragment key={`${p.text}-${i}`}>
                <motion.span className="sentence-word" layout="position" initial={{ opacity: 0 }} animate={WORD_IN}>
                  <span className="sentence-token-text">{word}</span>
                  {i === words.length - 1 && (
                    <>
                      <span className="sentence-chevron" aria-hidden="true" />
                      {p.suffix && <span className="sentence-suffix">{p.suffix}</span>}
                    </>
                  )}
                </motion.span>
                {i < words.length - 1 && " "}
              </Fragment>
            ))}
          </span>
        );
      })}
    </p>
  );
}
