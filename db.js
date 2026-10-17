import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DOG_WALKS_DATA || path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'dog-walks.db');

let db;

export function getDb() {
  if (!db) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    initialize();
  }
  return db;
}

export function initialize() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS walks (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      date      TEXT    NOT NULL,          -- '2026-10-17'
      time      TEXT    NOT NULL,          -- '10:30'
      type      TEXT    NOT NULL CHECK(type IN ('walk','pee')),
      poo_size  TEXT                       -- NULL, 'big', 'medium', 'small'
        CHECK(poo_size IS NULL OR poo_size IN ('big','medium','small')),
      note      TEXT    DEFAULT '',
      created_at TEXT   DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS pees (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      walk_id   INTEGER NOT NULL REFERENCES walks(id) ON DELETE CASCADE,
      size      TEXT    NOT NULL CHECK(size IN ('big','medium','small'))
    );

    CREATE INDEX IF NOT EXISTS idx_walks_date ON walks(date);
  `);
}

// ── CRUD ─────────────────────────────────────────────────────────────────

export function addWalk({ date, time, type, poo_size, pees: peesArr, note }) {
  const db = getDb();
  db.exec('BEGIN');
  try {
    const stmt = db.prepare(`
      INSERT INTO walks (date, time, type, poo_size, note)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(date, time, type, poo_size, note || '');

    const row = db.prepare('SELECT last_insert_rowid() AS id').get();
    const walkId = row.id;

    if (peesArr && peesArr.length > 0) {
      const peeStmt = db.prepare('INSERT INTO pees (walk_id, size) VALUES (?, ?)');
      for (const size of peesArr) {
        peeStmt.run(walkId, size);
      }
    }

    db.exec('COMMIT');
    return walkId;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export function getWalks({ date, limit = 50, offset = 0 } = {}) {
  const db = getDb();

  let where = '';
  const params = [];
  if (date) {
    where = 'WHERE w.date = ?';
    params.push(date);
  }

  const stmt = db.prepare(`
    SELECT
      w.id, w.date, w.time, w.type, w.poo_size, w.note, w.created_at,
      COALESCE(
        (SELECT json_group_array(json_object('id', p.id, 'size', p.size))
         FROM pees p WHERE p.walk_id = w.id),
        '[]'
      ) AS pees_json
    FROM walks w
    ${where}
    ORDER BY w.date DESC, w.time DESC
    LIMIT ? OFFSET ?
  `);
  const rows = stmt.all(...params, limit, offset);

  return rows.map(r => ({
    ...r,
    pees: JSON.parse(r.pees_json),
  }));
}

export function getWalk(id) {
  const db = getDb();
  const walk = db.prepare(`
    SELECT id, date, time, type, poo_size, note, created_at
    FROM walks WHERE id = ?
  `).get(id);

  if (!walk) return null;

  const pees = db.prepare('SELECT id, size FROM pees WHERE walk_id = ?').all(id);
  return { ...walk, pees };
}

export function updateWalk({ id, date, time, type, poo_size, pees: peesArr, note }) {
  const db = getDb();
  db.exec('BEGIN');
  try {
    db.prepare(`
      UPDATE walks
      SET date = ?, time = ?, type = ?, poo_size = ?, note = ?
      WHERE id = ?
    `).run(date, time, type, poo_size, note, id);

    db.prepare('DELETE FROM pees WHERE walk_id = ?').run(id);
    if (peesArr && peesArr.length > 0) {
      const peeStmt = db.prepare('INSERT INTO pees (walk_id, size) VALUES (?, ?)');
      for (const size of peesArr) {
        peeStmt.run(id, size);
      }
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export function deleteWalk(id) {
  getDb().prepare('DELETE FROM walks WHERE id = ?').run(id);
}

// ── Stats ──────────────────────────────────────────────────────────────
export function getStats({ days = 7 } = {}) {
  const db = getDb();
  const now = new Date();
  now.setDate(now.getDate() - days + 1);
  const sinceStr = now.toISOString().slice(0, 10);

  const perDayStmt = db.prepare(`
    SELECT
      w.date,
      COUNT(*)                                                         AS total,
      SUM(CASE WHEN w.type = 'walk'  THEN 1 ELSE 0 END)              AS walks,
      SUM(CASE WHEN w.type = 'pee'   THEN 1 ELSE 0 END)              AS pees,
      SUM(CASE WHEN w.poo_size IS NOT NULL THEN 1 ELSE 0 END)         AS poos,
      SUM(CASE WHEN w.poo_size = 'big'    THEN 1 ELSE 0 END)          AS poo_big,
      SUM(CASE WHEN w.poo_size = 'medium' THEN 1 ELSE 0 END)          AS poo_medium,
      SUM(CASE WHEN w.poo_size = 'small'  THEN 1 ELSE 0 END)          AS poo_small,
      (SELECT COUNT(*) FROM pees p WHERE p.walk_id IN
        (SELECT id FROM walks WHERE date = w.date)
      )                                                               AS pee_count
    FROM walks w
    WHERE w.date >= ?
    GROUP BY w.date
    ORDER BY w.date DESC
  `);
  const perDay = perDayStmt.all(sinceStr);

  const totalsStmt = db.prepare(`
    SELECT
      COUNT(*)                                              AS total,
      SUM(CASE WHEN type = 'walk'  THEN 1 ELSE 0 END)      AS walks,
      SUM(CASE WHEN type = 'pee'   THEN 1 ELSE 0 END)      AS pees,
      SUM(CASE WHEN poo_size IS NOT NULL THEN 1 ELSE 0 END) AS poos,
      (SELECT COUNT(*) FROM pees)                           AS pee_count
    FROM walks
    WHERE date >= ?
  `);
  const totals = totalsStmt.get(sinceStr);

  return { perDay, totals, since: sinceStr };
}