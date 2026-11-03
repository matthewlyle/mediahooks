import { Fragment } from "react";
import type { Webhook } from "../../src/types.ts";
import { webhookParts } from "../lib/sentence.ts";

type Props = { w: Pick<Webhook, "events" | "users" | "libraries">; className: string };

export function SentenceSummary({ w, className }: Props) {
  const parts = webhookParts(w);
  return (
    <p className={className}>
      {parts.map((p) => (
        <Fragment key={p.key}>
          {p.kind === "words" && `${p.text} `}
          {p.kind === "space" && " "}
          {p.kind === "token" && (
            <>
              <span className="summary-value">{p.full}</span>
              {p.suffix}
            </>
          )}
        </Fragment>
      ))}
    </p>
  );
}
