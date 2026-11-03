import { motion } from "motion/react";
import { useRef, useState } from "react";
import { Button } from "../components/Button.tsx";
import { CopyButton } from "../components/CopyButton.tsx";
import { PlexConnection } from "../components/PlexStatus.tsx";
import { api } from "../lib/api.ts";
import { fadeIn, flash, pageTransition } from "../lib/motion.ts";
import { useRouteHeading } from "../lib/nav.ts";
import { useStore } from "../lib/store.tsx";
import "./HelpPage.css";

export function HelpPage() {
  const heading = useRouteHeading<HTMLHeadingElement>();
  const { meta, refresh } = useStore();
  const code = useRef<HTMLElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const ingestUrl = `${location.origin}/plex?token=${meta?.ingestToken ?? ""}`;

  async function onReplace() {
    setReplacing(true);
    const res = await api<{ ingestToken: string }>("/api/ingest-token", { method: "POST" });
    if (res.ok) await refresh();
    setReplacing(false);
    setConfirming(false);
    flash(row.current, res.ok ? "accent" : "error");
  }

  return (
    <motion.div className="page page-help" {...pageTransition}>
      <motion.section className="panel help" {...fadeIn}>
        <h2 ref={heading} tabIndex={-1}>Help</h2>
        <ol className="help-steps">
          <li>
            In Plex Web, add this under Account → Webhooks (needs Plex Pass):
            <div className="help-url" ref={row}>
              <code ref={code}>{ingestUrl}</code>
              {confirming ? (
                <>
                  <Button variant="danger" className="ingest-btn" disabled={replacing} onClick={() => void onReplace()}>
                    Replace token
                  </Button>
                  <Button className="ingest-btn" disabled={replacing} onClick={() => setConfirming(false)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <CopyButton
                    text={ingestUrl}
                    className="ingest-btn"
                    onFail={() => code.current && getSelection()?.selectAllChildren(code.current)}
                  />
                  <Button className="ingest-btn" onClick={() => setConfirming(true)}>
                    New token
                  </Button>
                </>
              )}
            </div>
            {confirming && (
              <p className="muted help-warning">Plex's events are rejected until you paste the new URL into Plex.</p>
            )}
            <PlexConnection />
          </li>
          <li>Add a webhook here: pick a template or write your own body.</li>
          <li>Choose when it sends, then press Send test.</li>
        </ol>
      </motion.section>
    </motion.div>
  );
}
