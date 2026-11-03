import type { Component, Extracted } from "./extract.ts";
import { GROUPS } from "./fixture.ts";
import { stageUrl } from "./protocol.ts";

const PALETTE = ["--bg", "--surface", "--raised", "--fg", "--muted", "--accent", "--success", "--error"];
const SIZES = ["--text-20", "--text-16", "--text-14", "--text-12"];
const LABELS: readonly string[] = [...GROUPS, "Other"];

export function componentGroups(components: Component[]): { label: string; components: Component[] }[] {
  const byName = [...components].sort((a, b) => a.name.localeCompare(b.name));
  const groupOf = (c: Component) => (c.group && LABELS.includes(c.group) ? c.group : "Other");
  return LABELS.map((label) => ({ label, components: byName.filter((c) => groupOf(c) === label) })).filter((g) => g.components.length > 0);
}

export function OverviewPage({ data }: { data: Extracted }) {
  const values = new Map(data.cssTokens.map((t) => [t.name, t.value]));
  const palette = PALETTE.filter((n) => values.has(n));
  const groups = componentGroups(data.components);

  return (
    <article className="pg-page">
      <h1>mediahooks design system</h1>
      <p className="pg-lead">Tokens and components from public/ui, rendered live.</p>

      <div className="pg-bento">
        <section className="pg-card pg-card-wide" aria-labelledby="ov-palette">
          <h2 id="ov-palette">Palette</h2>
          <ul className="pg-palette">
            {palette.map((n) => (
              <li key={n}>
                <span className="pg-chip pg-chip-lg">
                  <span style={{ background: `var(${n})` }} />
                </span>
                <span className="pg-mono">{n}</span>
                <span className="pg-mono pg-muted">{values.get(n)}</span>
              </li>
            ))}
          </ul>
          <a className="pg-card-link" href="#tokens">
            All tokens
          </a>
        </section>

        <section className="pg-card" aria-labelledby="ov-type">
          <h2 id="ov-type">Type</h2>
          <div className="pg-faces">
            <figure>
              <span style={{ fontFamily: "var(--sans)" }}>Aa</span>
              <figcaption>Space Grotesk</figcaption>
            </figure>
            <figure>
              <span style={{ fontFamily: "var(--mono)" }}>Aa</span>
              <figcaption>Space Mono</figcaption>
            </figure>
          </div>
          <ul className="pg-sizes">
            {SIZES.filter((n) => values.has(n)).map((n) => (
              <li key={n}>
                <span style={{ fontFamily: "var(--sans)", fontSize: `var(${n})` }}>Fan out every Plex event</span>
                <span className="pg-mono pg-muted">{n}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="pg-card" aria-labelledby="ov-use">
          <h2 id="ov-use">In use</h2>
          <div className="pg-canvas">
            <iframe title="Components in use" src={stageUrl("showcase")} style={{ width: "100%", height: 320 }} />
          </div>
        </section>

        <section className="pg-card pg-card-wide" aria-labelledby="ov-components">
          <h2 id="ov-components">
            Components <span className="pg-muted">{data.components.length}</span>
          </h2>
          <ul className="pg-components">
            {groups.flatMap((g) =>
              g.components.map((c) => (
                <li key={c.name}>
                  <a href={`#${encodeURIComponent(c.name)}`}>
                    <span className="pg-mono">{c.name}</span>
                    {c.doc && <span className="pg-muted">{c.doc.split(/(?<=\.)\s/)[0]}</span>}
                  </a>
                </li>
              )),
            )}
          </ul>
        </section>
      </div>
    </article>
  );
}
