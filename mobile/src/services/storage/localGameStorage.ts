import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import type { LocalGameState, LocalMatchRecord } from '../../game-engine';

/**
 * Durable offline storage (SQLite):
 *  - local_matches: finished offline matches (history + queue for server-verified sync, idempotent via client_match_id)
 *  - local_active:  the single unfinished local game, saved after every move so an interrupted match can be resumed
 */
export interface StoredMatch {
  id: number;
  clientMatchId: string;
  record: LocalMatchRecord;
  playedAt: string;
  synced: boolean;
  p1Name: string;
  p2Name: string;
}

export interface ActiveLocalGame {
  state: LocalGameState;
  p1Name: string;
  p2Name: string;
  p1Avatar: string;
  p2Avatar: string;
  p1Mark: 'X' | 'O';
  savedAt: number;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function db(): Promise<SQLite.SQLiteDatabase> {
  dbPromise ??= (async () => {
    const d = await SQLite.openDatabaseAsync('tictactoe-local.db');
    await d.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS local_matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_match_id TEXT NOT NULL UNIQUE,
        payload TEXT NOT NULL,
        p1_name TEXT NOT NULL,
        p2_name TEXT NOT NULL,
        played_at TEXT NOT NULL,
        synced INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_local_matches_played ON local_matches (played_at DESC);
      CREATE TABLE IF NOT EXISTS local_active (
        key TEXT PRIMARY KEY NOT NULL,
        payload TEXT NOT NULL
      );
    `);
    return d;
  })();
  return dbPromise;
}

interface Row {
  id: number;
  client_match_id: string;
  payload: string;
  p1_name: string;
  p2_name: string;
  played_at: string;
  synced: number;
}

const toStored = (r: Row): StoredMatch => ({
  id: r.id,
  clientMatchId: r.client_match_id,
  record: JSON.parse(r.payload) as LocalMatchRecord,
  playedAt: r.played_at,
  synced: r.synced === 1,
  p1Name: r.p1_name,
  p2Name: r.p2_name,
});

export const localGameStorage = {
  /** Stores a finished match. Idempotent per clientMatchId (never duplicates a result). */
  async saveMatch(record: LocalMatchRecord, p1Name: string, p2Name: string, clientMatchId: string = Crypto.randomUUID()): Promise<string> {
    const d = await db();
    await d.runAsync(
      'INSERT OR IGNORE INTO local_matches (client_match_id, payload, p1_name, p2_name, played_at, synced) VALUES (?, ?, ?, ?, ?, 0)',
      clientMatchId,
      JSON.stringify(record),
      p1Name,
      p2Name,
      record.playedAt,
    );
    return clientMatchId;
  },

  /** The phone's own copy of a match (with its moves), found by the id it was uploaded under. */
  async findByClientId(clientMatchId: string): Promise<StoredMatch | null> {
    const d = await db();
    const row = await d.getFirstAsync<Row>('SELECT * FROM local_matches WHERE client_match_id = ?', clientMatchId);
    return row ? toStored(row) : null;
  },

  async listMatches(limit = 100): Promise<StoredMatch[]> {
    const d = await db();
    const rows = await d.getAllAsync<Row>('SELECT * FROM local_matches ORDER BY played_at DESC, id DESC LIMIT ?', limit);
    return rows.map(toStored);
  },

  async unsynced(limit = 50): Promise<StoredMatch[]> {
    const d = await db();
    const rows = await d.getAllAsync<Row>('SELECT * FROM local_matches WHERE synced = 0 ORDER BY id ASC LIMIT ?', limit);
    return rows.map(toStored);
  },

  async markSynced(clientMatchIds: string[]): Promise<void> {
    if (!clientMatchIds.length) return;
    const d = await db();
    await d.withTransactionAsync(async () => {
      for (const id of clientMatchIds) await d.runAsync('UPDATE local_matches SET synced = 1 WHERE client_match_id = ?', id);
    });
  },

  async deleteMatch(id: number): Promise<void> {
    const d = await db();
    await d.runAsync('DELETE FROM local_matches WHERE id = ?', id);
  },

  async clearMatches(): Promise<void> {
    const d = await db();
    await d.runAsync('DELETE FROM local_matches');
  },

  async saveActive(game: ActiveLocalGame): Promise<void> {
    const d = await db();
    await d.runAsync('INSERT OR REPLACE INTO local_active (key, payload) VALUES (?, ?)', 'current', JSON.stringify(game));
  },

  async loadActive(): Promise<ActiveLocalGame | null> {
    const d = await db();
    const row = await d.getFirstAsync<{ payload: string }>('SELECT payload FROM local_active WHERE key = ?', 'current');
    if (!row) return null;
    try {
      return JSON.parse(row.payload) as ActiveLocalGame;
    } catch {
      await d.runAsync('DELETE FROM local_active WHERE key = ?', 'current');
      return null;
    }
  },

  async clearActive(): Promise<void> {
    const d = await db();
    await d.runAsync('DELETE FROM local_active WHERE key = ?', 'current');
  },
};
