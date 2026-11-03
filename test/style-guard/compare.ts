import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

type Dump = { defaults: Record<string, Record<string, string>>; nodes: Record<string, Record<string, string>> };
type Run = Record<string, Dump>;

const [basePath = "test/style-guard/baseline.json.gz", currentPath = "test/style-guard/current.json"] = process.argv.slice(2);
const load = (p: string) => {
  const raw = readFileSync(p);
  return JSON.parse((p.endsWith(".gz") ? gunzipSync(raw) : raw).toString("utf8")) as Run;
};

function expand(dump: Dump, path: string) {
  const base = path.split("@")[0]!;
  if (base.includes("::")) return dump.nodes[path]!;
  const last = base.slice(base.lastIndexOf(">") + 1).replace(/\[\d+\]$/, "");
  return { ...dump.defaults[last], ...dump.nodes[path] };
}

const before = load(basePath);
const after = load(currentPath);
const lines: string[] = [];

for (const state of new Set([...Object.keys(before), ...Object.keys(after)])) {
  const a = before[state];
  const b = after[state];
  if (!a || !b) {
    lines.push(`${state}  (${a ? "removed" : "added"} state)`);
    continue;
  }
  for (const path of new Set([...Object.keys(a.nodes), ...Object.keys(b.nodes)])) {
    const id = `${state} ${path}`;
    if (!a.nodes[path] || !b.nodes[path]) {
      lines.push(`${id}  (${a.nodes[path] ? "removed" : "added"})`);
      continue;
    }
    const x = expand(a, path);
    const y = expand(b, path);
    for (const prop of new Set([...Object.keys(x), ...Object.keys(y)])) {
      if (prop.startsWith("--")) continue;
      if (x[prop] !== y[prop]) lines.push(`${id}  ${prop}  ${x[prop] ?? "(unset)"} → ${y[prop] ?? "(unset)"}`);
    }
  }
}

if (lines.length) console.log(lines.join("\n"));
