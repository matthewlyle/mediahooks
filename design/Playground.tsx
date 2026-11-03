import { useEffect, useRef, useState } from "react";
import type { Component, Extracted } from "./extract.ts";
import { componentGroups, OverviewPage } from "./OverviewPage.tsx";
import type { StageWidth } from "./protocol.ts";
import { ComponentPage } from "./ComponentPage.tsx";
import { TokensPage } from "./TokensPage.tsx";

const pathOf = () => decodeURIComponent(location.hash.slice(1)) || "overview";

type NavGroup = { label: string; links: { href: string; label: string; page: string }[] };

function navGroups(components: Component[]): NavGroup[] {
  return [
    {
      label: "Foundations",
      links: [
        { href: "#overview", label: "Overview", page: "overview" },
        { href: "#tokens", label: "Tokens", page: "tokens" },
      ],
    },
    ...componentGroups(components).map((g) => ({
      label: g.label,
      links: g.components.map((c) => ({ href: `#${encodeURIComponent(c.name)}`, label: c.name, page: c.name })),
    })),
  ];
}

function Nav({ data, page }: { data: Extracted | null; page: string }) {
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      e.preventDefault();
      input.current?.focus();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const q = query.trim().toLowerCase();
  const groups = navGroups(data?.components ?? [])
    .map((g) => ({ ...g, links: g.links.filter((l) => l.label.toLowerCase().includes(q)) }))
    .filter((g) => g.links.length > 0);

  return (
    <nav className="pg-nav" aria-label="Design system">
      <a href="#overview" className="pg-brand">
        mediahooks
        <span>design system</span>
      </a>
      <div className="pg-filter">
        <input
          ref={input}
          type="search"
          aria-label="Filter pages"
          placeholder="Filter"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setQuery("");
          }}
        />
        <kbd aria-hidden="true">/</kbd>
      </div>
      {groups.map((g) => {
        const id = `nav-${g.label.toLowerCase()}`;
        return (
          <div key={g.label} role="group" aria-labelledby={id} className="pg-nav-group">
            <span id={id} className="pg-nav-label">
              {g.label}
            </span>
            {g.links.map((l) => (
              <a key={l.page} href={l.href} aria-current={page === l.page ? "page" : undefined}>
                {l.label}
              </a>
            ))}
          </div>
        );
      })}
      {groups.length === 0 && <p className="pg-nav-empty">No matches</p>}
    </nav>
  );
}

export function Playground() {
  const [data, setData] = useState<Extracted | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(pathOf);
  const [stageWidth, setStageWidth] = useState<StageWidth>("fill");
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    fetch("/api/extracted")
      .then((r) => (r.ok ? (r.json() as Promise<Extracted>) : Promise.reject(new Error(`${r.status}`))))
      .then(setData, (e: Error) => setError(e.message));
    const onHash = () => {
      setPage(pathOf());
      scrollTo(0, 0);
    };
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  const component = data?.components.find((c) => c.name === page);
  const bench = !!component;

  return (
    <div className="pg">
      <Nav data={data} page={page} />
      <main className={bench ? "pg-main pg-main-bench" : "pg-main"}>
        {error && <p role="alert">Could not load the extractor output: {error}</p>}
        {!data && !error && <p className="pg-muted">Loading</p>}
        {data && page === "overview" && <OverviewPage data={data} />}
        {data && page === "tokens" && <TokensPage data={data} />}
        {data && component && (
          <ComponentPage key={component.name} component={component} width={stageWidth} setWidth={setStageWidth} reduced={reduced} setReduced={setReduced} />
        )}
        {data && page !== "overview" && page !== "tokens" && !component && <p>No page named {page}.</p>}
      </main>
    </div>
  );
}
