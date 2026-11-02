import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import index from "../public/index.html";
import { createApp } from "./app.ts";
import { openDb } from "./db.ts";

const PORT = Number(process.env.PORT ?? 8787);
const DB_PATH = process.env.DB_PATH ?? "data/mediahooks.db";
const AUTH = process.env.AUTH !== "off";
const PLEX_URL = process.env.PLEX_URL;

if (!PLEX_URL) {
  console.error("PLEX_URL is required: the address mediahooks uses to reach your Plex server, e.g. http://localhost:32400");
  process.exit(1);
}

mkdirSync(dirname(DB_PATH), { recursive: true });
const { server, dispatcher } = createApp({
  port: PORT,
  db: openDb(DB_PATH),
  index,
  publicUrl: process.env.PUBLIC_URL || undefined,
  groupQuietMs: process.env.GROUP_QUIET_MS ? Number(process.env.GROUP_QUIET_MS) : undefined,
  groupMaxMs: process.env.GROUP_MAX_MS ? Number(process.env.GROUP_MAX_MS) : undefined,
  auth: AUTH,
  plexUrl: PLEX_URL,
  plexTvUrl: process.env.PLEX_TV_URL || "https://plex.tv",
});

console.log(`mediahooks listening on ${server.url}`);
console.log(`Plex webhook URL: ${new URL("/plex", server.url)}?token=… (the full URL is on the Help page)`);
if (!AUTH) console.log("AUTH=off: the UI and API are open to anyone who can reach this port");

async function shutdown(): Promise<void> {
  await dispatcher.flushAll();
  process.exit(0);
}
// `bun --hot` re-runs this module in the same process; don't stack handlers.
const hot = globalThis as { mediahooksShutdown?: () => void };
if (hot.mediahooksShutdown) {
  process.off("SIGTERM", hot.mediahooksShutdown);
  process.off("SIGINT", hot.mediahooksShutdown);
}
hot.mediahooksShutdown = () => void shutdown();
process.on("SIGTERM", hot.mediahooksShutdown);
process.on("SIGINT", hot.mediahooksShutdown);
