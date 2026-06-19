import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let DB_PATH = path.join(__dirname, '../../local.db');

try {
  if (process.versions && process.versions.electron) {
    const { app } = require('electron');
    const userDataPath = app.getPath('userData');
    DB_PATH = path.join(userDataPath, 'local.db');
  }
} catch (e) {}

let _db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (_db) return _db;

  _db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  await _db.exec('PRAGMA journal_mode = WAL');
  await _db.exec('PRAGMA foreign_keys = ON');
  await _db.exec('PRAGMA synchronous = NORMAL');

  await initSchema(_db);
  return _db;
}

async function initSchema(db: Database): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS tunnels (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      license_key TEXT NOT NULL UNIQUE,
      subdomain   TEXT,
      local_port  INTEGER,
      wg_ip       TEXT,
      conf_path   TEXT,
      status      TEXT DEFAULT 'inactive',
      expires_at  TEXT,
      created_at  TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at  TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  console.log('[DB] Local SQLite database ready at:', DB_PATH);
}

export async function initDb(): Promise<void> {
  await getDb();
}
