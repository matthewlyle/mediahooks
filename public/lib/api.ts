export type Meta = { version: string; events: string[]; templateVars: string[]; ingestToken: string };
export type PlexStatus = { lastEventAt: number | null };
export type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error: string };

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export async function api<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      ...init,
      headers: init?.body ? { "content-type": "application/json" } : undefined,
    });
    if (res.status === 401 && !path.startsWith("/api/auth/")) onUnauthorized?.();
    if (res.status === 204) return { ok: true, status: 204, data: undefined as T };
    const body = await res.json().catch(() => null);
    if (res.ok) return { ok: true, status: res.status, data: body as T };
    return { ok: false, status: res.status, error: body?.error ?? `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, status: 0, error: (err as Error).message };
  }
}
