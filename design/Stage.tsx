import { isValidElement, useEffect, useMemo, useRef, useState } from "react";
import { fixtures } from "design:fixtures";
import type { Fixture } from "./fixture.ts";
import type { FromStage, ToStage } from "./protocol.ts";
import { rewriteSheets } from "./reduced-motion.ts";
import { showcase } from "./showcase.tsx";

function show(v: unknown): string {
  if (v instanceof Event) return `[${v.constructor.name}]`;
  try {
    return JSON.stringify(v) ?? String(v);
  } catch {
    return String(v);
  }
}

const replacer = (_key: string, v: unknown) => (typeof v === "function" || isValidElement(v) ? undefined : v);

function snapshot(values: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    try {
      const json = JSON.stringify(v, replacer);
      if (json !== undefined) out[k] = JSON.parse(json);
    } catch {}
  }
  return out;
}

const post = (m: FromStage) => parent.postMessage(m, location.origin);

function useReducedSheets(on: boolean) {
  useEffect(() => {
    if (!on) return;
    const rewrite = () => rewriteSheets(document);
    rewrite();
    addEventListener("load", rewrite);
    const observer = new MutationObserver((records) => {
      for (const r of records) {
        for (const n of r.addedNodes) {
          if (n instanceof HTMLStyleElement) rewrite();
          else if (n instanceof HTMLLinkElement) n.addEventListener("load", rewrite, { once: true });
        }
      }
    });
    observer.observe(document.head, { childList: true });
    return () => {
      removeEventListener("load", rewrite);
      observer.disconnect();
    };
  }, [on]);
}

export function Stage() {
  const params = new URLSearchParams(location.search);
  const name = params.get("c") ?? "";
  const callbacks = params.get("cb")?.split(",").filter(Boolean) ?? [];
  const fixture: Fixture | undefined = name === "showcase" ? showcase : fixtures[name];
  const [values, setValues] = useState<Record<string, unknown>>(() => ({ ...fixture?.props }));
  const announce = useRef(true);
  useReducedSheets(params.has("reduced"));

  useEffect(() => {
    if (!announce.current) return;
    announce.current = false;
    post({ type: "values", values: snapshot(values) });
  }, [values]);

  useEffect(() => {
    const onMessage = (e: MessageEvent<ToStage>) => {
      if (e.source !== window.parent || e.origin !== location.origin || e.data?.type !== "set") return;
      const { name, value } = e.data;
      setValues((v) => ({ ...v, [name]: value }));
    };
    addEventListener("message", onMessage);
    return () => removeEventListener("message", onMessage);
  }, []);

  const props = useMemo(() => {
    const out: Record<string, unknown> = { ...values };
    for (const cb of callbacks) {
      out[cb] = (...args: unknown[]) => {
        post({ type: "call", text: `${cb}(${args.map(show).join(", ")})` });
        const bind = fixture?.bind?.[cb];
        if (bind) announce.current = true;
        if (typeof bind === "string") setValues((v) => ({ ...v, [bind]: args[0] }));
        else if (bind) setValues((v) => ({ ...v, ...bind(...args) }));
        return fixture?.returns?.[cb]?.(...args);
      };
    }
    return out;
  }, [values, fixture]);

  const Live = fixture?.component;
  return (
    <main className="stage">
      {Live ? (
        <Live {...props} />
      ) : (
        <p className="muted">
          No fixture for {name}. Add design/fixtures/{name}.tsx.
        </p>
      )}
    </main>
  );
}
