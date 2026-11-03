import { useEffect, useRef, useState, type ReactNode } from "react";
import { animate } from "motion/react";
import type { Extracted, Token } from "./extract.ts";
import * as motionModule from "../public/lib/motion.ts";

const COLOR = /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\(|color-mix\()/i;

const SECTIONS = ["Neutrals", "Accent and status", "Opacity steps", "Brand previews", "Type scale", "Fonts", "Spacing", "Radius", "Effects"] as const;
type Section = (typeof SECTIONS)[number];

function sectionOf(t: Token): Section {
  if (/^--(font|sans|mono)\b/.test(t.name) && !/size|weight|leading|line/.test(t.name)) return "Fonts";
  if (/^--(text|fs|font-size|type)/.test(t.name)) return "Type scale";
  if (/^--(space|gap|pad)/.test(t.name)) return "Spacing";
  if (/^--radius/.test(t.name)) return "Radius";
  if (/^--(discord|slack|plex)-/.test(t.name)) return "Brand previews";
  const color = COLOR.test(t.value) || /^var\(--/.test(t.value);
  if (color && /^--[a-z-]+-\d+$/.test(t.name)) return "Opacity steps";
  if (color && /^--(accent|success|error|on-accent)/.test(t.name)) return "Accent and status";
  if (color) return "Neutrals";
  return "Effects";
}

type Move = { label: string; transition: Record<string, unknown> };

function movesOf(label: string, v: unknown): Move[] {
  if (Array.isArray(v) && v.length === 4 && v.every((n) => typeof n === "number")) return [{ label, transition: { duration: 0.8, ease: v } }];
  if (!v || typeof v !== "object") return [];
  const o = v as Record<string, unknown>;
  if (o.type === "spring" || "duration" in o) return [{ label, transition: o }];
  if (o.transition && typeof o.transition === "object") return [{ label, transition: o.transition as Record<string, unknown> }];
  return Object.entries(o).flatMap(([k, e]) => movesOf(`${label}.${k}`, e));
}

function Replay({ move, run }: { move: Move; run: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!run || !ref.current) return;
    const c = animate(ref.current, { x: [0, 160] }, move.transition as never);
    return () => c.stop();
  }, [run, move]);
  return (
    <div className="pg-motion">
      <span className="pg-mono">{move.label}</span>
      <div className="pg-track">
        <span ref={ref} className="pg-dot" />
      </div>
    </div>
  );
}

function useCopy() {
  const [status, setStatus] = useState<{ name: string; ok: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = (name: string) => {
    const done = (ok: boolean) => {
      clearTimeout(timer.current);
      setStatus({ name, ok });
      timer.current = setTimeout(() => setStatus(null), 1500);
    };
    navigator.clipboard.writeText(name).then(
      () => done(true),
      () => done(false),
    );
  };
  const copied = (name: string) => (status?.ok && status.name === name ? true : undefined);
  const message = status ? `${status.ok ? "Copied" : "Couldn't copy"} ${status.name}` : "";
  return { copy, copied, message };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="pg-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Chip({ name, size }: { name: string; size?: "lg" }) {
  return (
    <span className={size ? "pg-chip pg-chip-lg" : "pg-chip"}>
      <span style={{ background: `var(${name})` }} />
    </span>
  );
}

export function TokensPage({ data }: { data: Extracted }) {
  const [run, setRun] = useState(0);
  const { copy, copied, message } = useCopy();
  const groups = Object.groupBy(data.cssTokens, sectionOf);
  const moves = data.motionTokens.flatMap((t) => movesOf(t.name, (motionModule as Record<string, unknown>)[t.name]));
  const steps = Object.groupBy(groups["Opacity steps"] ?? [], (t) => t.name.replace(/-\d+$/, ""));

  const name = (n: string) => (
    <button type="button" className="pg-copy" data-copied={copied(n)} onClick={() => copy(n)}>
      {n}
      {copied(n) && <span aria-hidden="true"> ✓</span>}
    </button>
  );

  const row = (t: Token, preview?: ReactNode) => (
    <div key={t.name} className="pg-row">
      {name(t.name)}
      <span className="pg-mono pg-muted">{t.value}</span>
      {preview ?? <span className="pg-muted pg-small">{t.doc}</span>}
    </div>
  );

  const swatches = (tokens: Token[]) => (
    <div className="pg-swatches">
      {tokens.map((t) => (
        <div key={t.name} className="pg-swatch">
          <Chip name={t.name} size="lg" />
          {name(t.name)}
          <span className="pg-mono pg-muted">{t.value}</span>
          {t.doc && <span className="pg-muted pg-small">{t.doc}</span>}
        </div>
      ))}
    </div>
  );

  const effect = (t: Token) => {
    if (/^\s*(inset\s+)?-?\d/.test(t.value)) return <span className="pg-effect" style={{ boxShadow: `var(${t.name})` }} />;
    if (/\b(solid|dashed|dotted)\b/.test(t.value)) return <span className="pg-effect" style={{ outline: `var(${t.name})` }} />;
    return null;
  };

  const sections: Record<Section, (tokens: Token[]) => ReactNode> = {
    Neutrals: swatches,
    "Accent and status": swatches,
    "Brand previews": swatches,
    "Opacity steps": () =>
      Object.entries(steps).map(([base, tokens]) => (
        <div key={base} className="pg-steps">
          <span className="pg-mono">{base}</span>
          <div className="pg-strip">
            {tokens!.map((t) => (
              <button
                key={t.name}
                type="button"
                className="pg-copy"
                aria-label={t.name}
                title={`${t.name} ${t.value}${t.doc ? " " + t.doc : ""}`}
                data-copied={copied(t.name)}
                onClick={() => copy(t.name)}
              >
                <Chip name={t.name} />
                <span className="pg-mono">
                  {t.name.match(/\d+$/)![0]}
                  {copied(t.name) && <span aria-hidden="true"> ✓</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      )),
    "Type scale": (tokens) => tokens.map((t) => row(t, <span style={{ fontFamily: "var(--sans)", fontSize: `var(${t.name})` }}>Fan out every Plex event</span>)),
    Fonts: (tokens) =>
      tokens.map((t) => row(t, <span style={{ fontFamily: `var(${t.name})`, fontSize: 18 }}>Pack my box with five dozen liquor jugs 0123456789</span>)),
    Spacing: (tokens) => tokens.map((t) => row(t, <span className="pg-bar" style={{ width: `var(${t.name})` }} />)),
    Radius: (tokens) => tokens.map((t) => row(t, <span className="pg-box" style={{ borderRadius: `var(${t.name})` }} />)),
    Effects: (tokens) =>
      tokens.map((t) =>
        row(
          t,
          <span className="pg-effect-cell">
            {effect(t)}
            {t.doc && <span className="pg-muted pg-small">{t.doc}</span>}
          </span>,
        ),
      ),
  };

  return (
    <article className="pg-page">
      <h1>Tokens</h1>
      <p className="pg-lead">From public/ui/tokens.css and public/lib/motion.ts. Select a name to copy it.</p>
      <p role="status" className="pg-sr">
        {message}
      </p>
      {!data.cssTokens.length && !data.motionTokens.length && <p className="pg-muted">No tokens found.</p>}

      {SECTIONS.map((s) => {
        const tokens = groups[s];
        return tokens?.length ? (
          <Section key={s} title={s}>
            {sections[s](tokens)}
          </Section>
        ) : null;
      })}

      {data.motionTokens.length > 0 && (
        <Section title="Motion">
          <button type="button" className="pg-button" onClick={() => setRun((n) => n + 1)}>
            Replay
          </button>
          {moves.map((m) => (
            <Replay key={m.label} move={m} run={run} />
          ))}
          {data.motionTokens.map((t) => row(t))}
        </Section>
      )}
    </article>
  );
}
