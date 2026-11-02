import type { Database } from "bun:sqlite";

export const NEW_KEY = "lower(hex(randomblob(16)))";

const BASE_SCHEMA = `
CREATE TABLE IF NOT EXISTS webhooks (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  headers TEXT NOT NULL DEFAULT '{}',
  body_template TEXT NOT NULL DEFAULT '',
  events TEXT NOT NULL DEFAULT '["*"]',
  users TEXT NOT NULL DEFAULT '[]',
  libraries TEXT NOT NULL DEFAULT '[]',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS deliveries (
  id INTEGER PRIMARY KEY,
  webhook_id INTEGER NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  status INTEGER,
  ok INTEGER NOT NULL,
  error TEXT,
  duration_ms INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS deliveries_webhook ON deliveries(webhook_id, id DESC);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  event TEXT NOT NULL,
  payload TEXT NOT NULL,      -- JSON, as received
  routing TEXT NOT NULL,      -- JSON Routing[]: every webhook and why it was or wasn't sent
  received_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  thumb TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
`;

type Migration = (db: Database) => void;

const hasColumn = (db: Database, table: string, column: string) =>
  db.query<{ name: string }, []>(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);

// Index + 1 is the PRAGMA user_version after it runs. Append only; never edit a shipped migration.
const MIGRATIONS: Migration[] = [
  // Databases from before numbered migrations can be in any older layout, so each step checks first.
  (db) => {
    const added = [
      ["webhooks", "attach_poster", "INTEGER NOT NULL DEFAULT 0"],
      ["events", "thumb", "BLOB"],
      ["events", "thumb_type", "TEXT"],
      ["events", "thumb_key", "TEXT"],
      ["deliveries", "attempts", "INTEGER NOT NULL DEFAULT 1"],
    ];
    for (const [table, column, definition] of added) {
      if (!hasColumn(db, table!, column!)) db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
    const removed = [
      ["webhooks", "method"],
      ["webhooks", "cooldown_minutes"],
      ["deliveries", "is_test"],
    ];
    for (const [table, column] of removed) {
      if (hasColumn(db, table!, column!)) db.run(`ALTER TABLE ${table} DROP COLUMN ${column}`);
    }
    db.run(`UPDATE webhooks SET events = '["*"]' WHERE events = '[]'`);
    db.run(`UPDATE events SET thumb_key = ${NEW_KEY} WHERE thumb IS NOT NULL AND thumb_key IS NULL`);
    db.run(`DELETE FROM settings WHERE key = 'owner_id'`);
  },
  (db) => {
    db.run("ALTER TABLE deliveries ADD COLUMN request TEXT");
    db.run("ALTER TABLE deliveries ADD COLUMN response TEXT");
  },
];

export const SCHEMA_VERSION = MIGRATIONS.length;

export function migrate(db: Database): void {
  db.run(BASE_SCHEMA);
  const { user_version: version } = db.query<{ user_version: number }, []>("PRAGMA user_version").get()!;
  if (version > SCHEMA_VERSION) {
    throw new Error(
      `This database is from a newer mediahooks (schema ${version}; this version knows up to ${SCHEMA_VERSION}). Run the newer version, or restore a backup.`,
    );
  }
  for (let v = version; v < SCHEMA_VERSION; v++) {
    db.transaction(() => {
      MIGRATIONS[v]!(db);
      db.run(`PRAGMA user_version = ${v + 1}`);
    })();
  }
}
