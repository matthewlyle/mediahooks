import { Fragment, useEffect, useState } from "react";
import type { Extracted } from "./extract.ts";
import { ComponentPage } from "./ComponentPage.tsx";
import { TokensPage } from "./TokensPage.tsx";

const pathOf = () => decodeURIComponent(location.hash.slice(1)) || "tokens";

export function Playground() {
  const [data, setData] = useState<Extracted | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(pathOf);

  useEffect(() => {
    fetch("/api/extracted")
      .then((r) => (r.ok ? (r.json() as Promise<Extracted>) : Promise.reject(new Error(`${r.status}`))))
      .then(setData, (e: Error) => setError(e.message));
    const onHash = () => setPage(pathOf());
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  const component = data?.components.find((c) => c.name === page);

  const groups = [...Map.groupBy(data?.components ?? [], (c) => c.group ?? "")].sort(([a], [b]) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)));

  return (
    <div className="pg">
      <nav className="pg-nav" aria-label="Playground">
        <strong>mediahooks design</strong>
        <a href="#tokens" aria-current={page === "tokens" ? "page" : undefined}>
          Tokens
        </a>
        {groups.map(([group, components]) => (
          <Fragment key={group}>
            {group && <span className="pg-nav-group">{group}</span>}
            {components.map((c) => (
              <a key={c.name} href={`#${encodeURIComponent(c.name)}`} aria-current={page === c.name ? "page" : undefined}>
                {c.name}
              </a>
            ))}
          </Fragment>
        ))}
      </nav>
      <main className="pg-main">
        {error && <p role="alert">Could not load the extractor output: {error}</p>}
        {!data && !error && <p className="muted">Loading</p>}
        {data && page === "tokens" && <TokensPage data={data} />}
        {data && component && <ComponentPage key={component.name} component={component} />}
        {data && page !== "tokens" && !component && <p className="muted">No component named {page}.</p>}
      </main>
    </div>
  );
}
