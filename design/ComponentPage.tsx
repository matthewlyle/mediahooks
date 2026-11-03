import { useMemo, useState } from "react";
import type { Component, Prop } from "./extract.ts";
import { fixtures } from "design:fixtures";

type Kind = "boolean" | "select" | "string" | "number" | "callback" | "json";

export function kindOf(p: Prop): Kind {
  if (p.type.includes("=>")) return "callback";
  if (p.options) return "select";
  if (p.type === "boolean") return "boolean";
  if (p.type === "string" || /ReactNode$/.test(p.type)) return "string";
  if (p.type === "number") return "number";
  return "json";
}

function show(v: unknown): string {
  if (v instanceof Event) return `[${v.constructor.name}]`;
  try {
    return JSON.stringify(v) ?? String(v);
  } catch {
    return String(v);
  }
}

function JsonControl({ id, value, onChange }: { id: string; value: unknown; onChange: (v: unknown) => void }) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2) ?? "");
  const [bad, setBad] = useState(false);
  return (
    <textarea
      id={id}
      className="mono"
      rows={3}
      value={text}
      aria-invalid={bad}
      onChange={(e) => {
        setText(e.target.value);
        if (!e.target.value.trim()) {
          setBad(false);
          onChange(undefined);
          return;
        }
        try {
          onChange(JSON.parse(e.target.value));
          setBad(false);
        } catch {
          setBad(true);
        }
      }}
    />
  );
}

function Control({ prop, value, set }: { prop: Prop; value: unknown; set: (v: unknown) => void }) {
  const id = `ctl-${prop.name}`;
  switch (kindOf(prop)) {
    case "boolean":
      return <input id={id} type="checkbox" role="switch" checked={!!value} onChange={(e) => set(e.target.checked)} />;
    case "select":
      return (
        <select id={id} value={value === undefined ? "" : String(value)} onChange={(e) => set(e.target.value === "" ? undefined : e.target.value)}>
          {!prop.required && <option value="">(unset)</option>}
          {prop.options!.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case "string":
      return <input id={id} type="text" value={typeof value === "string" ? value : ""} onChange={(e) => set(e.target.value)} />;
    case "number":
      return <input id={id} type="number" value={typeof value === "number" ? value : ""} onChange={(e) => set(e.target.value === "" ? undefined : Number(e.target.value))} />;
    case "callback":
      return <span className="muted">logged</span>;
    case "json":
      return <JsonControl id={id} value={value} onChange={set} />;
  }
}

export function ComponentPage({ component }: { component: Component }) {
  const fixture = fixtures[component.name];
  const [values, setValues] = useState<Record<string, unknown>>(() => ({ ...fixture?.props }));
  const [log, setLog] = useState<string[]>([]);

  const props = useMemo(() => {
    const out: Record<string, unknown> = { ...values };
    for (const p of component.props) {
      if (kindOf(p) !== "callback") continue;
      out[p.name] = (...args: unknown[]) => {
        setLog((l) => [...l, `${p.name}(${args.map(show).join(", ")})`]);
        const bind = fixture?.bind?.[p.name];
        if (typeof bind === "string") setValues((v) => ({ ...v, [bind]: args[0] }));
        else if (bind) setValues((v) => ({ ...v, ...bind(...args) }));
        return fixture?.returns?.[p.name]?.(...args);
      };
    }
    return out;
  }, [values, component, fixture]);

  const set = (name: string) => (v: unknown) => setValues((cur) => ({ ...cur, [name]: v }));
  const Live = fixture?.component;

  return (
    <article>
      <h1>{component.name}</h1>
      <p className="muted">{component.file}</p>
      {component.doc && <p className="pg-doc">{component.doc}</p>}

      <h2>Preview</h2>
      <div className="pg-stage">{Live ? <Live {...props} /> : <p className="muted">No fixture for {component.name} in design/fixtures/</p>}</div>

      <h2>Controls</h2>
      {component.props.length ? (
        <div className="pg-controls">
          {component.props.map((p) => (
            <div key={p.name} className="pg-control">
              <label htmlFor={`ctl-${p.name}`}>{p.name}</label>
              <Control prop={p} value={values[p.name]} set={set(p.name)} />
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">No props.</p>
      )}

      <h2>Callback log</h2>
      <div className="pg-log mono" role="log" aria-label="Callback log">
        {log.length ? log.map((l, i) => <div key={i}>{l}</div>) : <span className="muted">No calls yet.</span>}
      </div>
      {log.length > 0 && (
        <button type="button" onClick={() => setLog([])}>
          Clear log
        </button>
      )}

      <h2>Props</h2>
      <table className="pg-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Default</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {component.props.map((p) => (
            <tr key={p.name}>
              <td className="mono">
                {p.name}
                {p.required ? "" : "?"}
              </td>
              <td className="mono">{p.type}</td>
              <td className="mono">{p.default ?? ""}</td>
              <td>{p.doc ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {component.inherits.length > 0 && <p className="muted">Also accepts {component.inherits.join(", ")}.</p>}
    </article>
  );
}
