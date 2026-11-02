import { Fragment } from "react";
import type { Webhook } from "../../src/types.ts";
import { partsText, webhookParts } from "../lib/sentence.ts";

type Props = { w: Pick<Webhook, "events" | "users" | "libraries">; className: string };

export function SentenceSummary({ w, className }: Props) {
  const parts = webhookParts(w);
  return (
    <p className={className} title={partsText(parts, true)}>
      {parts.map((p) => (
        <Fragment key={p.key}>
          {p.kind === "words" && `${p.text} `}
          {p.kind === "space" && " "}
          {p.kind === "token" && (
            <>
              <span className="summary-value">{p.text}</span>
              {p.suffix}
            </>
          )}
        </Fragment>
      ))}
    </p>
  );
}
