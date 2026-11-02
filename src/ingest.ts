import { timingSafeEqual } from "node:crypto";
import type { Db } from "./db.ts";
import type { Dispatcher } from "./dispatch.ts";
import { error } from "./http.ts";
import type { PlexPayload, Poster } from "./types.ts";

const TOKEN_KEY = "ingest_token";

const newToken = () => Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64url");

export type Ingest = {
  handle(req: Request): Promise<Response>;
  token(): string;
  replaceToken(): string;
};

async function parse(req: Request): Promise<{ payload: PlexPayload; poster?: Poster } | Response> {
  const type = req.headers.get("content-type") ?? "";
  let raw: unknown;
  let poster: Poster | undefined;
  if (type.includes("multipart/form-data")) {
    const form = await req.formData();
    raw = form.get("payload");
    const thumb = form.get("thumb");
    if (thumb instanceof Blob && thumb.size > 0) {
      poster = { bytes: await thumb.bytes(), type: thumb.type || "image/jpeg" };
    }
  } else if (type.includes("application/json")) raw = await req.text();
  else return error("unsupported content type", 415);

  if (typeof raw !== "string" || raw === "") return error("missing payload", 400);

  let payload: PlexPayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return error("invalid payload", 400);
  }
  if (typeof payload !== "object" || payload === null || typeof payload.event !== "string") {
    return error("invalid payload", 400);
  }
  return { payload, poster };
}

export function createIngest(db: Db, dispatcher: Dispatcher): Ingest {
  let token = db.getSetting(TOKEN_KEY) ?? "";
  if (!token) {
    token = newToken();
    db.setSetting(TOKEN_KEY, token);
  }
  let expected = Buffer.from(token);

  return {
    async handle(req) {
      const given = Buffer.from(new URL(req.url).searchParams.get("token") ?? "");
      if (given.length !== expected.length || !timingSafeEqual(given, expected)) return error("invalid token", 401);
      const parsed = await parse(req);
      if (parsed instanceof Response) return parsed;
      void dispatcher.ingest(parsed.payload, parsed.poster).catch(console.error);
      return new Response("ok");
    },
    token: () => token,
    replaceToken() {
      token = newToken();
      db.setSetting(TOKEN_KEY, token);
      expected = Buffer.from(token);
      return token;
    },
  };
}
