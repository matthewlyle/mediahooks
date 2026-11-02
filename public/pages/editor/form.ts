import { ALL_EVENTS, type Webhook, type WebhookInput } from "../../../src/types.ts";
import { SAMPLE_PAYLOAD } from "../../../src/sample.ts";
import { isJsonContentType, renderTemplate } from "../../../src/template.ts";
import { PRESETS, presetForUrl, type Preset } from "../../presets.ts";

export type FormState = {
  name: string;
  url: string;
  headers: string;
  allEvents: boolean;
  events: string[];
  users: string;
  libraries: string;
  bodyTemplate: string;
  enabled: boolean;
  attachPoster: boolean;
};

export const EMPTY_FORM: FormState = {
  name: "",
  url: "",
  headers: "",
  allEvents: false,
  events: [],
  users: "",
  libraries: "",
  bodyTemplate: "",
  enabled: true,
  attachPoster: false,
};

export function toForm(w: Webhook): FormState {
  return {
    name: w.name,
    url: w.url,
    headers: Object.entries(w.headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n"),
    allEvents: w.events.includes(ALL_EVENTS),
    events: w.events.filter((e) => e !== ALL_EVENTS),
    users: w.users.join(", "),
    libraries: w.libraries.join(", "),
    bodyTemplate: w.bodyTemplate,
    enabled: w.enabled,
    attachPoster: w.attachPoster,
  };
}

export function parseHeaders(text: string): { ok: true; headers: Record<string, string> } | { ok: false; error: string } {
  const headers: Record<string, string> = {};
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    const colon = line.indexOf(":");
    if (colon <= 0) return { ok: false, error: `Use "Key: Value" on each line: ${line.trim()}` };
    headers[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return { ok: true, headers };
}

export const FIELDS = ["name", "url", "events", "headers", "bodyTemplate"] as const;
export type Field = (typeof FIELDS)[number];
export type FieldErrors = Partial<Record<Field, string>>;

export function validateForm(f: FormState): FieldErrors {
  const errors: FieldErrors = {};
  if (!f.name.trim()) errors.name = "Name is required";
  const url = f.url.trim();
  if (!url) errors.url = "URL is required";
  else if (!URL.canParse(url) || !["http:", "https:"].includes(new URL(url).protocol)) {
    errors.url = "Enter an http:// or https:// URL";
  }
  const headers = parseHeaders(f.headers);
  if (!headers.ok) errors.headers = headers.error;
  if (!f.allEvents && f.events.length === 0) errors.events = "Choose at least one event.";
  if (f.bodyTemplate.trim() && isJsonContentType(headers.ok ? headers.headers : {})) {
    try {
      JSON.parse(renderTemplate(f.bodyTemplate, SAMPLE_PAYLOAD));
    } catch (err) {
      errors.bodyTemplate = `Not valid JSON: ${(err as Error).message}`;
    }
  }
  return errors;
}

export function fieldForServerError(message: string): { field: Field; error: string } | null {
  const error = message.replace(/^url\b/, "URL").replace(/^./, (c) => c.toUpperCase());
  if (message.startsWith("name ")) return { field: "name", error };
  if (message.startsWith("url ")) return { field: "url", error };
  if (message.startsWith("headers ")) return { field: "headers", error };
  if (message.startsWith("body template ")) return { field: "bodyTemplate", error };
  if (/\bevents?\b/.test(message)) return { field: "events", error };
  return null;
}

export function toInput(f: FormState, eventOrder: string[]): WebhookInput {
  const parsedHeaders = parseHeaders(f.headers);
  const [users, libraries] = [f.users, f.libraries].map((text) =>
    text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ) as [string[], string[]];
  return {
    name: f.name,
    url: f.url.trim(),
    headers: parsedHeaders.ok ? parsedHeaders.headers : {},
    events: f.allEvents ? [ALL_EVENTS] : eventOrder.filter((e) => f.events.includes(e)),
    users,
    libraries,
    bodyTemplate: f.bodyTemplate,
    enabled: f.enabled,
    attachPoster: f.attachPoster,
  };
}

export function applyPreset(f: FormState, p: Preset): FormState {
  const name = !f.name.trim() || PRESETS.some((other) => other.label === f.name) ? p.label : f.name;
  const events = p.events ? { allEvents: false, events: p.events } : {};
  return { ...f, name, headers: p.headers, bodyTemplate: p.body, attachPoster: p.attachPoster, ...events };
}

export function presetToApply(f: FormState, url: string): Preset | undefined {
  const p = presetForUrl(url);
  if (!p || (f.bodyTemplate === p.body && f.headers === p.headers)) return undefined;
  const untouched =
    !f.bodyTemplate.trim() || PRESETS.some((o) => o.body === f.bodyTemplate && o.headers === f.headers);
  return untouched ? p : undefined;
}
