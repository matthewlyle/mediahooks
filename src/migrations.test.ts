import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "./db.ts";
import { SCHEMA_VERSION } from "./migrations.ts";

test("old databases are migrated, idempotently, keep their rows, and accept new webhooks and deliveries", () => {
  const dir = mkdtempSync(join(tmpdir(), "mediahooks-db-"));
  const path = join(dir, "old.db");
  try {
    const old = new Database(path, { create: true });
    old.run(`CREATE TABLE webhooks (id INTEGER PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL,
      method TEXT NOT NULL CHECK (method IN ('POST','PUT','PATCH')), headers TEXT NOT NULL DEFAULT '{}', body_template TEXT NOT NULL DEFAULT '',
      events TEXT NOT NULL DEFAULT '["*"]', users TEXT NOT NULL DEFAULT '[]', libraries TEXT NOT NULL DEFAULT '[]',
      enabled INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, cooldown_minutes INTEGER NOT NULL DEFAULT 0)`);
    old.run(`CREATE TABLE events (id INTEGER PRIMARY KEY, event TEXT NOT NULL, payload TEXT NOT NULL,
      routing TEXT NOT NULL, received_at INTEGER NOT NULL)`);
    old.run(`INSERT INTO webhooks (name, url, method, created_at) VALUES ('old', 'http://localhost/', 'POST', 0)`);
    old.run(`INSERT INTO events (event, payload, routing, received_at) VALUES ('media.play', '{"event":"media.play"}', '[]', 0)`);
    old.run(`CREATE TABLE deliveries (id INTEGER PRIMARY KEY, webhook_id INTEGER NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
      event TEXT NOT NULL, status INTEGER, ok INTEGER NOT NULL, error TEXT, duration_ms INTEGER NOT NULL,
      is_test INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)`);
    old.run(`INSERT INTO deliveries (webhook_id, event, status, ok, duration_ms, is_test, created_at) VALUES (1, 'media.play', 200, 1, 12, 1, 0)`);
    old.close();

    openDb(path);
    const db = openDb(path);
    expect(db.listWebhooks()[0]?.attachPoster).toBe(false);
    expect(db.listEvents()[0]?.thumbKey).toBeNull();
    expect(db.latestThumb()).toBeNull();
    expect(db.listDeliveries(1)).toEqual([
      { id: 1, webhookId: 1, event: "media.play", status: 200, ok: true, error: null, durationMs: 12, attempts: 1, createdAt: 0 },
    ]);
    const created = db.createWebhook({
      name: "new",
      url: "http://localhost/",
      headers: {},
      bodyTemplate: "",
      events: ["*"],
      users: [],
      libraries: [],
      enabled: true,
      attachPoster: false,
    });
    const request = { url: "http://localhost/", headers: {}, body: "", truncated: false };
    const d = db.recordDelivery({ webhookId: created.id, event: "media.play", status: 200, ok: true, error: null, durationMs: 1, attempts: 1, request, response: null });
    expect(db.listWebhooks().map((w) => w.name)).toEqual(["old", "new"]);
    expect(db.getDelivery(d.id)?.request).toEqual(request);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("posters stored before poster keys existed get a random key", () => {
  const dir = mkdtempSync(join(tmpdir(), "mediahooks-db-"));
  const path = join(dir, "keys.db");
  try {
    const old = new Database(path, { create: true });
    old.run(`CREATE TABLE events (id INTEGER PRIMARY KEY, event TEXT NOT NULL, payload TEXT NOT NULL,
      routing TEXT NOT NULL, received_at INTEGER NOT NULL, thumb BLOB, thumb_type TEXT)`);
    old.run(`INSERT INTO events (event, payload, routing, received_at, thumb, thumb_type)
      VALUES ('media.play', '{"event":"media.play"}', '[]', 0, x'ffd8ff', 'image/jpeg'),
             ('media.pause', '{"event":"media.pause"}', '[]', 0, NULL, NULL)`);
    old.close();

    const db = openDb(path);
    const [pause, play] = db.listEvents();
    expect(pause!.thumbKey).toBeNull();
    expect(db.getThumb(play!.thumbKey!)?.bytes).toEqual(new Uint8Array([0xff, 0xd8, 0xff]));
    expect(db.getThumb("1")).toBeNull();
    expect(openDb(path).listEvents()[1]!.thumbKey).toBe(play!.thumbKey);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a database from a newer version is refused", () => {
  const dir = mkdtempSync(join(tmpdir(), "mediahooks-db-"));
  const path = join(dir, "version.db");
  try {
    openDb(path);

    new Database(path).run(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`);
    expect(() => openDb(path)).toThrow(/newer mediahooks/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
