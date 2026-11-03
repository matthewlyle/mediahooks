import { useEffect, useRef, useState } from "react";
import type { Component, Prop } from "./extract.ts";
import { stageUrl, type FromStage, type StageWidth, type ToStage } from "./protocol.ts";

type Kind = "boolean" | "select" | "string" | "number" | "callback" | "json";

export function kindOf(p: Prop): Kind {
  if (p.type.includes("=>")) return "callback";
  if (p.options) return "select";
  if (p.type === "boolean") return "boolean";
  if (p.type === "string" || /ReactNode$/.test(p.type)) return "string";
  if (p.type === "number") return "number";
  return "json";
}

const WIDTHS: [StageWidth, string][] = [
  [375, "375"],
  [768, "768"],
  ["fill", "Fill"],
];

function JsonControl({ id, value, onChange }: { id: string; value: unknown; onChange: (v: unknown) => void }) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2) ?? "");
  const [bad, setBad] = useState(false);
  return (
    <textarea
      id={id}
      className="pg-input pg-mono"
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

function Segments({ legend, name, options, value, set }: { legend: string; name: string; options: [string, string][]; value: string; set: (v: string) => void }) {
  return (
    <fieldset className="pg-seg">
      <legend>{legend}</legend>
      {options.map(([v, text]) => (
        <label key={v}>
          <input type="radio" name={name} value={v} checked={value === v} onChange={() => set(v)} />
          <span>{text}</span>
        </label>
      ))}
    </fieldset>
  );
}

function Control({ prop, value, set }: { prop: Prop; value: unknown; set: (v: unknown) => void }) {
  const id = `ctl-${prop.name}`;
  const label = (
    <label htmlFor={id} className="pg-field-label">
      {prop.name}
    </label>
  );
  switch (kindOf(prop)) {
    case "boolean":
      return (
        <div className="pg-field pg-field-inline">
          {label}
          <input id={id} type="checkbox" role="switch" className="pg-switch" checked={!!value} onChange={(e) => set(e.target.checked)} />
        </div>
      );
    case "select": {
      const options = prop.options!;
      if (options.length + (prop.required ? 0 : 1) <= 4) {
        const segs: [string, string][] = options.map((o) => [o, o]);
        if (!prop.required) segs.push(["", "Unset"]);
        return (
          <div className="pg-field">
            <Segments legend={prop.name} name={id} options={segs} value={value === undefined ? "" : String(value)} set={(v) => set(v === "" ? undefined : v)} />
          </div>
        );
      }
      return (
        <div className="pg-field">
          {label}
          <select id={id} className="pg-input" value={value === undefined ? "" : String(value)} onChange={(e) => set(e.target.value === "" ? undefined : e.target.value)}>
            {!prop.required && <option value="">Unset</option>}
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      );
    }
    case "string":
      return (
        <div className="pg-field">
          {label}
          <input id={id} type="text" className="pg-input" value={typeof value === "string" ? value : ""} onChange={(e) => set(e.target.value)} />
        </div>
      );
    case "number":
      return (
        <div className="pg-field">
          {label}
          <input
            id={id}
            type="number"
            className="pg-input"
            value={typeof value === "number" ? value : ""}
            onChange={(e) => set(e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </div>
      );
    case "callback":
      return (
        <div className="pg-field">
          <span className="pg-field-label">{prop.name}</span>
          <span className="pg-muted pg-small">Logged below</span>
        </div>
      );
    case "json":
      return (
        <div className="pg-field">
          {label}
          <JsonControl id={id} value={value} onChange={set} />
        </div>
      );
  }
}

type Props = {
  component: Component;
  width: StageWidth;
  setWidth: (w: StageWidth) => void;
  reduced: boolean;
  setReduced: (r: boolean) => void;
};

export function ComponentPage({ component, width, setWidth, reduced, setReduced }: Props) {
  const callbackNames = component.props.filter((p) => kindOf(p) === "callback").map((p) => p.name);
  const frame = useRef<HTMLIFrameElement>(null);
  const logEnd = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [generation, setGeneration] = useState(0);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    const onMessage = (e: MessageEvent<FromStage>) => {
      if (e.source !== frame.current?.contentWindow || e.origin !== location.origin) return;
      const m = e.data;
      if (m.type === "values") {
        setValues(m.values);
        setGeneration((g) => g + 1);
      } else if (m.type === "call") setLog((l) => [...l, m.text]);
    };
    addEventListener("message", onMessage);
    return () => removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    const el = logEnd.current?.parentElement;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  const set = (name: string) => (v: unknown) => {
    setValues((cur) => ({ ...cur, [name]: v }));
    frame.current?.contentWindow?.postMessage({ type: "set", name, value: v } satisfies ToStage, location.origin);
  };

  return (
    <div className="pg-bench">
      <article className="pg-bench-main">
        <h1>{component.name}</h1>
        <p className="pg-mono pg-muted">{component.file}</p>
        {component.doc && <p className="pg-doc">{component.doc}</p>}

        <div className="pg-toolbar">
          <Segments
            legend="Width"
            name="stage-width"
            options={WIDTHS.map(([w, text]) => [String(w), text])}
            value={String(width)}
            set={(v) => setWidth(v === "fill" ? "fill" : (Number(v) as StageWidth))}
          />
          <label className="pg-toggle">
            <input type="checkbox" role="switch" className="pg-switch" checked={reduced} onChange={(e) => setReduced(e.target.checked)} />
            Reduced motion
          </label>
        </div>

        <div className="pg-canvas">
          {component.fixture ? (
            <iframe
              ref={frame}
              title={`${component.name} preview`}
              src={stageUrl(component.name, callbackNames, reduced)}
              style={{ width: width === "fill" ? "100%" : `${width}px`, height: 480 }}
            />
          ) : (
            <p>No fixture yet. Add design/fixtures/{component.name}.tsx.</p>
          )}
        </div>

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
                <td className="pg-mono">
                  {p.name}
                  {p.required && <span className="pg-tag">required</span>}
                </td>
                <td className="pg-mono">{p.type}</td>
                <td className="pg-mono">{p.default ?? ""}</td>
                <td>{p.doc ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {component.inherits.length > 0 && <p className="pg-muted">Also accepts {component.inherits.join(", ")}.</p>}
      </article>

      <aside aria-label="Inspector" className="pg-inspector">
        <h2>Controls</h2>
        {component.props.length ? (
          <div key={generation} className="pg-controls">
            {component.props.map((p) => (
              <Control key={p.name} prop={p} value={values[p.name]} set={set(p.name)} />
            ))}
          </div>
        ) : (
          <p className="pg-muted">No props.</p>
        )}

        <div className="pg-log-head">
          <h2>Callback log</h2>
          {log.length > 0 && (
            <button type="button" className="pg-button" onClick={() => setLog([])}>
              Clear
            </button>
          )}
        </div>
        <div className="pg-log pg-mono" role="log" aria-label="Callback log">
          {log.length ? log.map((l, i) => <div key={i}>{l}</div>) : <span className="pg-muted">No calls yet.</span>}
          <div ref={logEnd} />
        </div>
      </aside>
    </div>
  );
}
