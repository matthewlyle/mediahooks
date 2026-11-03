import { useState } from "react";
import { Check } from "./Check.tsx";
import "./MultiSelect.css";

function AddField({ placeholder, onAdd }: { placeholder: string; onAdd: (value: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <input
      className="pop-add"
      placeholder={placeholder}
      aria-label={placeholder}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const v = value.trim().replace(/,/g, "");
        if (!v) return;
        onAdd(v);
        setValue("");
      }}
    />
  );
}

export type MultiSelectProps = {
  /** Label of the row that is checked while nothing is selected; checking it clears the selection. */
  any: string;
  /** Names currently checked. */
  selected: string[];
  /** Names offered as rows besides the selected ones. */
  known: string[];
  /** Placeholder and accessible name of the field for adding a new name. */
  placeholder: string;
  /** Called with the new selection after a name is checked, unchecked, added or cleared. */
  onChange: (names: string[]) => void;
};

/** A checkbox list of names with a field to add one that isn't listed. */
export function MultiSelect({ any, selected, known, placeholder, onChange }: MultiSelectProps) {
  const options = [...new Set([...known, ...selected])].sort((a, b) => a.localeCompare(b));
  const has = (n: string) => selected.some((s) => s.toLowerCase() === n.toLowerCase());
  return (
    <>
      <Check checked={selected.length === 0} onToggle={() => onChange([])}>
        {any}
      </Check>
      {options.map((n) => (
        <Check
          key={n}
          checked={has(n)}
          onToggle={() =>
            onChange(has(n) ? selected.filter((s) => s.toLowerCase() !== n.toLowerCase()) : [...selected, n])
          }
        >
          {n}
        </Check>
      ))}
      <AddField placeholder={placeholder} onAdd={(n) => !has(n) && onChange([...selected, n])} />
    </>
  );
}
