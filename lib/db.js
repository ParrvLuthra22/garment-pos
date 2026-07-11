import Database from 'better-sqlite3';
import path from 'path';

// DB lives in the project root as shop.db
const DB_PATH = path.join(process.cwd(), 'shop.db');

let _db = null;

export function getDB() {
  if (_db) return _db;

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');   // Better concurrent read performance
  _db.pragma('foreign_keys = ON');

  _db.exec(`
    -- Products: one row per SKU (e.g. Kurta-White-M)
    CREATE TABLE IF NOT EXISTS products (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      sku         TEXT UNIQUE NOT NULL,
      name        TEXT NOT NULL,
      category    TEXT NOT NULL DEFAULT '',
      color       TEXT NOT NULL DEFAULT '',
      size        TEXT NOT NULL DEFAULT '',
      mrp         REAL NOT NULL,
      gst_rate    REAL NOT NULL DEFAULT 12,
      barcode     TEXT UNIQUE,
      created_at  TEXT DEFAULT (datetime('now','localtime'))
    );

    -- Stock levels — one row per product
    CREATE TABLE IF NOT EXISTS inventory (
      product_id  INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
      quantity    INTEGER NOT NULL DEFAULT 0
    );

    -- Scans queued by the phone, consumed by the POS screen
    CREATE TABLE IF NOT EXISTS pending_scans (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode     TEXT NOT NULL,
      consumed    INTEGER NOT NULL DEFAULT 0,
      scanned_at  TEXT DEFAULT (datetime('now','localtime'))
    );

    -- Completed sales
    CREATE TABLE IF NOT EXISTS transactions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_no       TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL DEFAULT '',
      customer_phone TEXT NOT NULL DEFAULT '',
      subtotal      REAL NOT NULL DEFAULT 0,
      gst_amount    REAL NOT NULL DEFAULT 0,
      discount      REAL NOT NULL DEFAULT 0,
      total         REAL NOT NULL DEFAULT 0,
      payment_mode  TEXT NOT NULL DEFAULT 'cash',
      created_at    TEXT DEFAULT (datetime('now','localtime'))
    );

    -- Line items for each transaction
    CREATE TABLE IF NOT EXISTS transaction_items (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id  INTEGER NOT NULL REFERENCES transactions(id),
      product_id      INTEGER NOT NULL REFERENCES products(id),
      quantity        INTEGER NOT NULL,
      price_at_sale   REAL NOT NULL,
      gst_rate        REAL NOT NULL DEFAULT 0
    );

    -- Key-value shop settings
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );

    -- Seed default settings (ignored if already exist)
    INSERT OR IGNORE INTO settings (key, value) VALUES
      ('shop_name',    'My Garment Shop'),
      ('shop_address', ''),
      ('shop_phone',   ''),
      ('shop_gstin',   ''),
      ('gst_enabled',  '1');
  `);

  return _db;
}

// ── Bill number generator ─────────────────────────────────────────────────
export function nextBillNo(db) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const like  = `BILL-${today}-%`;
  const last  = db.prepare(
    `SELECT bill_no FROM transactions WHERE bill_no LIKE ? ORDER BY id DESC LIMIT 1`
  ).get(like);

  if (!last) return `BILL-${today}-001`;

  const seq = parseInt(last.bill_no.split('-').pop(), 10) + 1;
  return `BILL-${today}-${String(seq).padStart(3, '0')}`;
}

// ── Settings helpers ──────────────────────────────────────────────────────
export function getSetting(db, key) {
  return db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key)?.value ?? '';
}

export function setSetting(db, key, value) {
  db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run(key, String(value));
}
