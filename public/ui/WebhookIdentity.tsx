import { motion } from "motion/react";
import type { Ref } from "react";
import { SPRING, fadeIn, ids } from "../lib/motion.ts";
import type { Part } from "../lib/sentence.ts";
import { PausedBadge } from "./PausedBadge.tsx";
import { Sentence } from "./Sentence.tsx";
import "./WebhookIdentity.css";

export type WebhookIdentityProps = {
  /** Id of the webhook, which ties its name and URL to the same elements on the other page for the shared-element morph. */
  id: number;
  /** The webhook's name. */
  name: string;
  /** The URL the webhook posts to. */
  url: string;
  /** Whether the webhook is paused, which dims the name and URL and shows the Paused badge. */
  paused: boolean;
  /** The webhook's filters written out as a sentence. */
  parts: Part[];
  /** Where it is shown: a compact list card, or the larger detail heading, which renders the name as an h2. */
  variant: "card" | "detail";
  /** Receives the name element, so the detail page can move focus to its heading. Only used by the detail variant. */
  nameRef?: Ref<HTMLHeadingElement>;
};

/** A webhook's name, Paused badge, URL and sentence, dimmed when the webhook is paused. */
export function WebhookIdentity({ id, name, url, paused, parts, variant, nameRef }: WebhookIdentityProps) {
  const cls = (part: string) =>
    ["webhook-identity-" + part, "webhook-identity-" + variant, paused && "webhook-identity-paused"].filter(Boolean).join(" ");
  const nameProps = {
    layoutId: ids.name(id),
    layoutCrossfade: false,
    className: cls("name"),
    transition: { layout: SPRING.morph },
  } as const;
  return (
    <>
      <div className={cls("title")}>
        {variant === "detail" ? (
          <motion.h2 ref={nameRef} tabIndex={-1} {...nameProps}>
            {name}
          </motion.h2>
        ) : (
          <motion.span {...nameProps}>{name}</motion.span>
        )}
        <PausedBadge paused={paused} />
      </div>
      <motion.div
        layoutId={ids.url(id)}
        layoutCrossfade={false}
        className={cls("url")}
        transition={{ layout: SPRING.morph }}
      >
        {url}
      </motion.div>
      {variant === "detail" ? (
        <motion.div {...fadeIn}>
          <Sentence parts={parts} className="webhook-identity-sentence webhook-identity-detail" highlight />
        </motion.div>
      ) : (
        <Sentence parts={parts} className="webhook-identity-sentence webhook-identity-card" />
      )}
    </>
  );
}
