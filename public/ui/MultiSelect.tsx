import { Check } from "./Check.tsx";

export type MultiSelectProps = {
  /** Label of the row that is checked while nothing is selected; checking it clears the selection. */
  any: string;
  /** Names currently checked. */
  selected: string[];
  /** Names offered as rows besides the selected ones. */
  known: string[];
  /** Called with the new selection after a name is checked, unchecked or cleared. */
  onChange: (names: string[]) => void;
};

/** A checkbox list of names; selected names missing from `known` stay listed so they can be unchecked. */
export function MultiSelect({ any, selected, known, onChange }: MultiSelectProps) {
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
    </>
  );
}
