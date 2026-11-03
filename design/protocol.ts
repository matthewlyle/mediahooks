export type StageWidth = 375 | 768 | "fill";

export type ToStage = { type: "set"; name: string; value: unknown };

export type FromStage = { type: "values"; values: Record<string, unknown> } | { type: "call"; text: string };

export function stageUrl(name: string, callbacks: string[] = [], reduced = false): string {
  const q = new URLSearchParams({ c: name });
  if (callbacks.length) q.set("cb", callbacks.join(","));
  if (reduced) q.set("reduced", "1");
  return `/stage?${q}`;
}
