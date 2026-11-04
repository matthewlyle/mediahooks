import { useId, useState } from "react";
import { Disclosure } from "./Disclosure.tsx";
import { Field } from "./Field.tsx";
import "./VariableReference.css";

export type VariableGroup = { name: string; vars: string[] };

export type VariableReferenceProps = {
  /** Variables in display order; the first group starts open. */
  groups: VariableGroup[];
  /** Current value of each variable, keyed by name. Empty ones are listed in a single muted line. */
  values: Record<string, unknown>;
  /** What the empty variables are missing for, such as "movies". */
  emptyFor: string;
  /** Called with a variable name when its row is pressed. */
  onInsert: (name: string) => void;
};

const isEmpty = (v: unknown): boolean => v === undefined || v === null || v === "";
const text = (v: unknown): string => (typeof v === "string" ? v : JSON.stringify(v));

/** A searchable list of template variables in collapsible groups, each row showing its current value. */
export function VariableReference({ groups, values, emptyFor, onInsert }: VariableReferenceProps) {
  const uid = useId();
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(groups.slice(0, 1).map((g) => g.name)));
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const searching = needle !== "";

  const filled = groups.map((g) => ({
    name: g.name,
    vars: g.vars.filter(
      (v) => !isEmpty(values[v]) && (!searching || v.includes(needle) || text(values[v]).toLowerCase().includes(needle)),
    ),
  }));
  const missing = groups.flatMap((g) => g.vars.filter((v) => isEmpty(values[v]) && (!searching || v.includes(needle))));
  const visible = filled.filter((g) => g.vars.length > 0);

  function toggle(name: string, on: boolean) {
    setOpen((s) => {
      const next = new Set(s);
      if (on) next.add(name);
      else next.delete(name);
      return next;
    });
  }

  return (
    <div className="var-reference">
      <Field
        id={`${uid}-search`}
        error={undefined}
        errorId={`${uid}-search-error`}
        input={{
          type: "search",
          "aria-label": "Search variables",
          placeholder: "Search variables and values",
          autoComplete: "off",
          value: query,
          onChange: (e) => setQuery(e.target.value),
        }}
      />
      {visible.map((g) => (
        <Disclosure
          key={g.name}
          label={g.name}
          summary={g.vars.length}
          open={searching || open.has(g.name)}
          onOpenChange={(on) => toggle(g.name, on)}
        >
          <ul className="var-rows">
            {g.vars.map((v) => (
              <li key={v}>
                <button type="button" className="var-row" onMouseDown={(e) => e.preventDefault()} onClick={() => onInsert(v)}>
                  <code className="var-row-name">{`{{${v}}}`}</code>
                  <span className="var-row-value">{text(values[v])}</span>
                </button>
              </li>
            ))}
          </ul>
        </Disclosure>
      ))}
      {searching && visible.length === 0 && missing.length === 0 && <p className="var-note">No variables match.</p>}
      {missing.length > 0 && (
        <p className="var-note">
          Not for {emptyFor} ({missing.length}): {missing.join(", ")}
        </p>
      )}
    </div>
  );
}
