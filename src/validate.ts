import { ALL_EVENTS, PLEX_EVENTS, type WebhookInput } from "./types.ts";
import { SAMPLE_PAYLOAD } from "./sample.ts";
import { isJsonContentType, renderTemplate } from "./template.ts";

type Result = { ok: true; value: WebhookInput } | { ok: false; error: string };

const fail = (error: string): Result => ({ ok: false, error });

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function stringList(v: unknown): string[] | null {
  if (v === undefined) return [];
  if (!Array.isArray(v) || !v.every((s) => typeof s === "string")) return null;
  return v.map((s) => s.trim()).filter((s) => s !== "");
}

export function validateWebhook(body: unknown): Result {
  if (!isPlainObject(body)) return fail("body must be a JSON object");

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return fail("name is required");

  let urlOk = false;
  if (typeof body.url === "string") {
    try {
      const u = new URL(body.url);
      urlOk = u.protocol === "http:" || u.protocol === "https:";
    } catch {}
  }
  if (!urlOk) return fail("url must be an http(s) URL");
  const url = (body.url as string).trim();

  const headers = body.headers ?? {};
  if (!isPlainObject(headers) || !Object.values(headers).every((v) => typeof v === "string")) {
    return fail("headers must be an object of strings");
  }

  const events = body.events ?? [];
  if (!Array.isArray(events)) return fail("events must be an array");
  if (events.length === 0) return fail("choose at least one event");
  if (events.includes(ALL_EVENTS)) {
    if (events.length > 1) return fail(`"${ALL_EVENTS}" (all events) can't be combined with specific events`);
  } else {
    for (const e of events) {
      if (typeof e !== "string" || !(PLEX_EVENTS as readonly string[]).includes(e)) {
        return fail(`unknown event: ${String(e)}`);
      }
    }
  }

  const users = stringList(body.users);
  if (!users) return fail("users must be an array of strings");
  const libraries = stringList(body.libraries);
  if (!libraries) return fail("libraries must be an array of strings");

  const bodyTemplate = body.bodyTemplate ?? "";
  if (typeof bodyTemplate !== "string") return fail("bodyTemplate must be a string");

  const enabled = body.enabled ?? true;
  if (typeof enabled !== "boolean") return fail("enabled must be a boolean");

  const attachPoster = body.attachPoster ?? false;
  if (typeof attachPoster !== "boolean") return fail("attachPoster must be a boolean");

  const strHeaders = headers as Record<string, string>;
  if (bodyTemplate.trim() !== "" && isJsonContentType(strHeaders)) {
    try {
      JSON.parse(renderTemplate(bodyTemplate, SAMPLE_PAYLOAD));
    } catch (err) {
      return fail(`body template does not render valid JSON: ${(err as Error).message}`);
    }
  }

  return {
    ok: true,
    value: {
      name,
      url,
      headers: strHeaders,
      bodyTemplate,
      events: events as string[],
      users,
      libraries,
      enabled,
      attachPoster,
    },
  };
}
