import { useEffect, useRef, useState } from "react";
import { animate } from "motion/react";
import type { Extracted, Token } from "./extract.ts";
import * as motionModule from "../public/lib/motion.ts";

const COLOR = /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\(|color-mix\()/i;
const group = (t: Token): "color" | "type" | "space" | "radius" | "font" | "other" => {
  if (/^--(font|sans|mono)\b/.test(t.name) && !/size|weight|leading|line/.test(t.name)) return "font";
  if (/^--(text|fs|font-size|type)/.test(t.name)) return "type";
  if (/^--(space|gap|pad)/.test(t.name)) return "space";
  if (/^--radius/.test(t.name)) return "radius";
  if (COLOR.test(t.value) || /^var\(--/.test(t.value)) return "color";
  return "other";
};

function Doc({ t }: { t: Token }) {
  return t.doc ? <span className="muted"> {t.doc}</span> : null;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
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
      <span className="mono">{move.label}</span>
      <div className="pg-track">
        <span ref={ref} className="pg-dot" />
      </div>
    </div>
  );
}

export function TokensPage({ data }: { data: Extracted }) {
  const [run, setRun] = useState(0);
  const groups = Object.groupBy(data.cssTokens, group);
  const moves = data.motionTokens.flatMap((t) => movesOf(t.name, (motionModule as Record<string, unknown>)[t.name]).map((m) => ({ t, m })));

  return (
    <article>
      <h1>Tokens</h1>
      {!data.cssTokens.length && !data.motionTokens.length && <p className="muted">No tokens found.</p>}

      {groups.color && (
        <Section title="Colors">
          <div className="pg-swatches">
            {groups.color.map((t) => (
              <div key={t.name} className="pg-swatch">
                <span className="pg-chip" style={{ background: `var(${t.name})` }} />
                <span className="mono">{t.name}</span>
                <span className="muted mono">{t.value}</span>
                <Doc t={t} />
              </div>
            ))}
          </div>
        </Section>
      )}

      {groups.type && (
        <Section title="Type scale">
          {groups.type.map((t) => (
            <div key={t.name} className="pg-row">
              <span className="mono">{t.name}</span>
              <span className="muted mono">{t.value}</span>
              <span style={{ fontSize: `var(${t.name})` }}>The quick brown fox jumps over the lazy dog</span>
            </div>
          ))}
        </Section>
      )}

      {groups.space && (
        <Section title="Spacing">
          {groups.space.map((t) => (
            <div key={t.name} className="pg-row">
              <span className="mono">{t.name}</span>
              <span className="muted mono">{t.value}</span>
              <span className="pg-bar" style={{ width: `var(${t.name})` }} />
            </div>
          ))}
        </Section>
      )}

      {groups.radius && (
        <Section title="Radius">
          {groups.radius.map((t) => (
            <div key={t.name} className="pg-row">
              <span className="mono">{t.name}</span>
              <span className="muted mono">{t.value}</span>
              <span className="pg-box" style={{ borderRadius: `var(${t.name})` }} />
            </div>
          ))}
        </Section>
      )}

      {groups.font && (
        <Section title="Fonts">
          {groups.font.map((t) => (
            <div key={t.name} className="pg-row">
              <span className="mono">{t.name}</span>
              <span style={{ fontFamily: `var(${t.name})`, fontSize: 18 }}>Pack my box with five dozen liquor jugs 0123456789</span>
            </div>
          ))}
        </Section>
      )}

      {groups.other && (
        <Section title="Other">
          {groups.other.map((t) => (
            <div key={t.name} className="pg-row">
              <span className="mono">{t.name}</span>
              <span className="muted mono">{t.value}</span>
              <Doc t={t} />
            </div>
          ))}
        </Section>
      )}

      {data.motionTokens.length > 0 && (
        <Section title="Motion">
          <button type="button" onClick={() => setRun((n) => n + 1)}>
            Replay
          </button>
          {moves.map(({ t, m }) => (
            <Replay key={m.label} move={m} run={run} />
          ))}
          {data.motionTokens.map((t) => (
            <div key={t.name} className="pg-row">
              <span className="mono">{t.name}</span>
              <span className="muted mono">{t.value}</span>
              <Doc t={t} />
            </div>
          ))}
        </Section>
      )}
    </article>
  );
}
