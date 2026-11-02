import { maskBody, maskHeaders, maskUrl } from "./secrets.ts";
import { renderBody, renderHeaders, type Metadata, type TemplateContext } from "./template.ts";
import type { CapturedBody, Delivery, PlexPayload, Poster, SentRequest, Webhook } from "./types.ts";

export type SendResult = Pick<Delivery, "status" | "ok" | "error" | "durationMs">;

export type SendContext = { poster?: Poster; thumbUrl?: string; group?: Metadata[] };

export function posterUrl(publicUrl: string | undefined, thumbKey: string | null): string | undefined {
  return publicUrl && thumbKey ? `${publicUrl.replace(/\/+$/, "")}/thumbs/${thumbKey}` : undefined;
}

// Non-ASCII header values must be RFC 2047-encoded; fetch throws on non-Latin-1.
function headerValue(value: string): string {
  return /^[\x20-\x7e\t]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

export type Prepared = { url: string; headers: Headers; body: string | FormData | undefined };

type SendTarget = Pick<Webhook, "url" | "headers" | "bodyTemplate" | "attachPoster">;

export function prepare(w: SendTarget, p: PlexPayload, ctx: SendContext): Prepared {
  const vars: TemplateContext = { thumbUrl: ctx.thumbUrl, group: ctx.group };
  const userHeaders = renderHeaders(w.headers, p, vars);
  const rendered = renderBody(w.bodyTemplate, p, userHeaders, vars);
  const headers = new Headers(rendered ? { "content-type": "application/json" } : {});
  for (const [k, v] of Object.entries(userHeaders)) headers.set(k, headerValue(v));
  let body: string | FormData | undefined = rendered || undefined;
  if (w.attachPoster && ctx.poster) {
    body = new FormData();
    if (rendered) body.append("payload_json", rendered);
    body.append("files[0]", new Blob([ctx.poster.bytes], { type: ctx.poster.type }), "poster.jpg");
    headers.delete("content-type"); // fetch sets multipart/form-data with the boundary
  }
  return { url: w.url, headers, body };
}

export const errorMessage = (err: unknown) => String((err as Error)?.message ?? err);

const BODY_LIMIT = 8192;

function capture(headers: Headers, body: string): CapturedBody {
  const truncated = body.length > BODY_LIMIT;
  return {
    headers: maskHeaders(Object.fromEntries(headers)),
    body: truncated ? body.slice(0, BODY_LIMIT) : body,
    truncated,
  };
}

export function sentRequest(req: Prepared): SentRequest {
  if (!(req.body instanceof FormData)) {
    return { url: maskUrl(req.url), ...capture(req.headers, maskBody(req.body ?? "").text) };
  }
  const headers = new Headers(req.headers);
  headers.set("content-type", "multipart/form-data");
  const parts = [...req.body].map(([name, value]) =>
    typeof value === "string" ? `${name}:\n${value}` : `${name}: ${value.name} (${value.type}, ${value.size} bytes)`,
  );
  return { url: maskUrl(req.url), ...capture(headers, maskBody(parts.join("\n\n")).text) };
}

export type Transmitted = SendResult & { response: CapturedBody | null };

export async function transmit(req: Prepared): Promise<Transmitted> {
  const started = performance.now();
  let status: number | null = null;
  let ok = false;
  let error: string | null = null;
  let response: CapturedBody | null = null;
  try {
    const res = await fetch(req.url, {
      method: "POST",
      headers: req.headers,
      body: req.body,
      signal: AbortSignal.timeout(10_000),
    });
    status = res.status;
    ok = res.ok;
    const text = await res.text();
    response = capture(res.headers, text);
    error = res.ok ? null : text.slice(0, 500);
  } catch (err) {
    error = errorMessage(err);
  }
  return { status, ok, error, durationMs: Math.round(performance.now() - started), response };
}

export async function send(w: SendTarget, p: PlexPayload, ctx: SendContext = {}): Promise<SendResult> {
  let req: Prepared;
  try {
    req = prepare(w, p, ctx);
  } catch (err) {
    return { status: null, ok: false, error: errorMessage(err), durationMs: 0 };
  }
  const { response: _, ...result } = await transmit(req);
  return result;
}
