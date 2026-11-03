import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { AuthUser } from "../../src/types.ts";
import { Button } from "../ui/Button.tsx";
import { Spinner } from "../ui/Spinner.tsx";
import { api } from "../lib/api.ts";
import { EASE, SPRING } from "../lib/motion.ts";
import "./SignInPage.css";

type Pin = { id: number; code: string; authUrl: string };
type PinCheck = { status: "waiting" } | { status: "signed-in"; user: AuthUser };

const POLL_MS = 1500;
const GIVE_UP_MS = 5 * 60_000;

function openPopup(): Window | null {
  const width = 600;
  const height = 700;
  const left = Math.round(screenX + (outerWidth - width) / 2);
  const top = Math.round(screenY + (outerHeight - height) / 2);
  return open("", "mediahooks-sign-in", `popup,width=${width},height=${height},left=${left},top=${top}`);
}

export function SignInPage({ onSignedIn }: { onSignedIn: (user: AuthUser) => void }) {
  const attempt = useRef(0);
  const popup = useRef<Window | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(
    () => () => {
      attempt.current++;
      popup.current?.close();
    },
    [],
  );

  function stop(text: string | null, error = false) {
    popup.current?.close();
    popup.current = null;
    setWaiting(false);
    setLink(null);
    setNote(text ? { text, error } : null);
  }

  async function signIn() {
    if (waiting && !link) return;
    const id = ++attempt.current;
    popup.current?.close();
    popup.current = openPopup();
    setNote(null);
    setLink(null);
    setWaiting(true);

    const pin = await api<Pin>("/api/auth/pin", { method: "POST" });
    if (id !== attempt.current) return;
    if (!pin.ok) return stop(pin.status === 0 ? "Couldn't reach mediahooks." : pin.error, true);
    if (popup.current && !popup.current.closed) popup.current.location.href = pin.data.authUrl;
    else {
      popup.current = null;
      setLink(pin.data.authUrl);
    }

    const deadline = Date.now() + GIVE_UP_MS;
    let closedChecks = 0;
    while (id === attempt.current) {
      const delay = Promise.withResolvers<void>();
      setTimeout(delay.resolve, POLL_MS);
      await delay.promise;
      if (id !== attempt.current) return;
      if (Date.now() > deadline) return stop("Sign-in timed out. Try again.");
      const res = await api<PinCheck>(`/api/auth/pin/${pin.data.id}`, { method: "POST" });
      if (id !== attempt.current) return;
      if (!res.ok) return stop(res.status === 0 ? "Couldn't reach mediahooks." : res.error, true);
      if (res.data.status === "signed-in") {
        popup.current?.close();
        popup.current = null;
        return onSignedIn(res.data.user);
      }
      if (popup.current?.closed && ++closedChecks > 1) return stop(null);
    }
  }

  return (
    <motion.div
      className="page page-signin"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0, transition: { y: SPRING.page, opacity: { duration: 0.25, ease: EASE.css } } }}
      exit={{ opacity: 0, scale: 0.98, filter: "blur(4px)", transition: { duration: 0.2, ease: EASE.outQuint } }}
    >
      <div className="signin-panel">
        <h2 className="sr-only">Sign in</h2>
        <Button
          variant="primary"
          size="large"
          className="signin-btn"
          onClick={signIn}
          aria-disabled={(waiting && !link) || undefined}
          aria-busy={waiting || undefined}
        >
          {waiting && !link && <Spinner inverse />}
          {waiting && !link ? "Waiting for Plex…" : "Sign in with Plex"}
        </Button>
        <div role="status">
          {waiting && !link && <span className="sr-only">Waiting for Plex…</span>}
          <AnimatePresence initial={false} mode="wait">
            {(link || note) && (
              <motion.p
                key={link ? "link" : note!.text}
                className={`signin-note${note?.error ? " error" : ""}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.2, ease: EASE.css } }}
                exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE.css } }}
              >
                {link ? (
                  <a href={link} target="_blank" rel="noopener">
                    Open Plex sign-in
                  </a>
                ) : (
                  note!.text
                )}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
