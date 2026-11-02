export const PLEX_EVENTS = [
  "library.on.deck",
  "library.new",
  "media.pause",
  "media.play",
  "media.rate",
  "media.resume",
  "media.scrobble",
  "media.stop",
  "admin.database.backup",
  "admin.database.corrupted",
  "device.new",
  "playback.started",
] as const;

export type PlexEvent = (typeof PLEX_EVENTS)[number];

export type PlexPayload = {
  event: string;
  user?: boolean;
  owner?: boolean;
  Account?: { id?: number; title?: string; thumb?: string };
  Server?: { title?: string; uuid?: string };
  Player?: { local?: boolean; publicAddress?: string; title?: string; uuid?: string };
  Metadata?: Record<string, unknown> & {
    title?: string;
    librarySectionTitle?: string;
    librarySectionID?: number;
  };
};

export const ALL_EVENTS = "*";

export type Webhook = {
  id: number;
  name: string;
  url: string;
  headers: Record<string, string>;
  bodyTemplate: string;
  events: string[];
  users: string[];
  libraries: string[];
  enabled: boolean;
  attachPoster: boolean;
  createdAt: number;
};

export type WebhookInput = Omit<Webhook, "id" | "createdAt">;

export type Delivery = {
  id: number;
  webhookId: number;
  event: string;
  status: number | null;
  ok: boolean;
  error: string | null;
  durationMs: number;
  attempts: number;
  createdAt: number;
};

export type CapturedBody = { headers: Record<string, string>; body: string; truncated: boolean };
export type SentRequest = CapturedBody & { url: string };

export type DeliveryDetail = Delivery & { request: SentRequest | null; response: CapturedBody | null };

export type WebhookListItem = Webhook & { lastDelivery: Delivery | null };

export type RouteStatus = "sent" | "held" | "grouped" | "skipped";
export type Routing = { webhookId: number; name: string; status: RouteStatus; reason: string | null };

export type Poster = { bytes: Uint8Array<ArrayBuffer>; type: string };

export type IncomingEvent = {
  id: number;
  event: string;
  payload: PlexPayload;
  routing: Routing[];
  receivedAt: number;
  thumbKey: string | null;
};

export type AuthUser = { username: string; thumb: string };

export type Session = AuthUser & { userId: number; createdAt: number; expiresAt: number };

export type PlexUser = { id: number; title: string; thumb: string };

export type PlexLibrary = { id: number; title: string; type: string };
