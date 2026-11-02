import type { Webhook, WebhookInput } from "./types.ts";

export const MASK = "••••••";

const SECRET_WORDS: Record<string, true> = {
  token: true,
  key: true,
  apikey: true,
  secret: true,
  password: true,
  passwd: true,
  pass: true,
  auth: true,
  authorization: true,
  signature: true,
  sig: true,
  credential: true,
  credentials: true,
  cookie: true,
};

// Split on separators and camelCase so "apiKey" and "access_token" match but "author" doesn't.
export function isSecretName(name: string): boolean {
  return name
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z\d]+/)
    .some((word) => Object.hasOwn(SECRET_WORDS, word));
}

const looksSecret = (s: string) => s.length >= 16 && /[a-z]/i.test(s) && /\d/.test(s);

const looksToken = (s: string) => /^[\w-]{16,}$/.test(s) && looksSecret(s);

// The segment after one of these is the webhook's key, however short (Home Assistant, n8n, Apprise).
const KEY_AFTER: Record<string, true> = { webhook: true, "webhook-test": true, hooks: true, notify: true };

function decode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    return s;
  }
}

export function maskUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return raw;
  }
  let masked = false;
  const hide = (part: string, secret: boolean) => {
    if (!secret || part === "") return part;
    masked = true;
    return MASK;
  };
  const ntfy = u.hostname.split(".").includes("ntfy");
  const user = u.username ? `${u.username}${u.password ? `:${hide(u.password, true)}` : ""}@` : "";
  const segments = u.pathname.split("/");
  const path = segments
    .map((segment, i) => {
      const prev = decode(segments[i - 1] ?? "").toLowerCase();
      // On ntfy the topic (first segment) is the only secret there is.
      return hide(segment, looksSecret(decode(segment)) || Object.hasOwn(KEY_AFTER, prev) || (ntfy && i === 1));
    })
    .join("/");
  const query = u.search
    ? `?${u.search
        .slice(1)
        .split("&")
        .map((pair) => {
          const eq = pair.indexOf("=");
          if (eq < 0) return pair;
          const name = pair.slice(0, eq);
          const value = pair.slice(eq + 1);
          return `${name}=${hide(value, isSecretName(decode(name)) || looksSecret(decode(value)))}`;
        })
        .join("&")}`
    : "";
  return masked ? `${u.protocol}//${user}${u.host}${path}${query}${u.hash}` : raw;
}

export function maskHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k, isSecretName(k) && v !== "" && !v.includes("{{") ? MASK : v]),
  );
}

const JSON_PAIR = /("(?:[^"\\]|\\.)*")(\s*:\s*)"((?:[^"\\]|\\.)*)"/g;
const FORM_PAIR = /(^|[&?\s])([A-Za-z_][\w.-]*)=([^&\s"]+)/g;

export function maskBody(body: string): { text: string; secrets: string[] } {
  const found: { at: number; value: string }[] = [];
  const keep = (value: string, name: string) => !value.includes("{{") && (isSecretName(name) || looksToken(value));
  let text = body.replace(JSON_PAIR, (match, key: string, sep: string, value: string, at: number) => {
    if (!keep(value, key.slice(1, -1))) return match;
    found.push({ at, value });
    return `${key}${sep}"${MASK}"`;
  });
  text = text.replace(FORM_PAIR, (match, lead: string, name: string, value: string, at: number) => {
    if (value.includes(MASK) || !keep(value, name)) return match;
    found.push({ at, value });
    return `${lead}${name}=${MASK}`;
  });
  return { text, secrets: found.sort((a, b) => a.at - b.at).map((f) => f.value) };
}

export function maskWebhook<W extends Webhook>(w: W): W {
  return { ...w, url: maskUrl(w.url), headers: maskHeaders(w.headers), bodyTemplate: maskBody(w.bodyTemplate).text };
}

type Unmasked = { ok: true; value: WebhookInput } | { ok: false; error: string };

export function unmask(input: WebhookInput, saved: Pick<Webhook, "url" | "headers" | "bodyTemplate"> | null): Unmasked {
  let url = input.url;
  if (saved && url === maskUrl(saved.url)) url = saved.url;
  else if (url.includes(MASK)) return { ok: false, error: "url has a hidden part; paste the full URL again" };
  // Saved secrets only ever go back to the URL they were saved with.
  const sameUrl = saved !== null && url === saved.url;

  const savedHeaders = new Map(Object.entries(saved?.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(input.headers)) {
    if (!value.includes(MASK)) {
      headers[name] = value;
      continue;
    }
    const kept = savedHeaders.get(name.toLowerCase());
    if (value !== MASK || kept === undefined || !sameUrl) {
      return { ok: false, error: `headers include a hidden ${name} value; type it again` };
    }
    headers[name] = kept;
  }

  let bodyTemplate = input.bodyTemplate;
  const hidden = bodyTemplate.split(MASK).length - 1;
  if (hidden > 0) {
    const secrets = saved ? maskBody(saved.bodyTemplate).secrets : [];
    if (!sameUrl || hidden !== secrets.length) {
      return { ok: false, error: "body template has hidden values; type them again" };
    }
    let i = 0;
    bodyTemplate = bodyTemplate.replaceAll(MASK, () => secrets[i++]!);
  }
  return { ok: true, value: { ...input, url, headers, bodyTemplate } };
}
