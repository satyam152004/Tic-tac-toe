import { statisticsApi, LocalMatchUpload } from './api/statisticsApi';
import { toApiError } from './api/errors';
import { localGameStorage, StoredMatch } from './storage/localGameStorage';

/**
 * Uploads finished OFFLINE matches so they appear in the account's history/statistics.
 *  - The server REPLAYS the moves with the shared engine; the claimed result is ignored and offline results never award
 *    points / XP / leaderboard entries (only the separate `local*` counters change).
 *  - Idempotent: every match carries a stable clientMatchId; the server answers `duplicates` for repeats, so a retry after a
 *    lost response can never double-count.
 *  - Matches the server rejects as invalid are marked done too (retrying would never succeed).
 *  - Single flight: concurrent triggers (login + foreground + network regain) share one run.
 */
let running: Promise<number> | null = null;

const toUpload = (m: StoredMatch): LocalMatchUpload => ({
  clientMatchId: m.clientMatchId,
  size: m.record.config.size,
  winLength: m.record.config.winLength,
  mode: m.record.mode,
  difficulty: m.record.difficulty,
  humanMark: m.record.mode === 'VS_AI' ? m.record.humanMark : undefined,
  moves: m.record.moves,
  durationMs: Math.max(0, Math.round(m.record.durationMs)),
  playedAt: m.record.playedAt,
});

export function syncLocalMatches(): Promise<number> {
  running ??= (async () => {
    let synced = 0;
    try {
      for (;;) {
        const batch = await localGameStorage.unsynced(25);
        if (batch.length === 0) break;
        const res = await statisticsApi.syncLocalMatches(batch.map(toUpload));
        await localGameStorage.markSynced(batch.map((m) => m.clientMatchId)); // accepted, duplicate or rejected: all final
        synced += res.accepted;
        if (batch.length < 25) break;
      }
    } catch (e) {
      // offline / server error: leave the rest queued for the next trigger
      void toApiError(e);
    } finally {
      running = null;
    }
    return synced;
  })();
  return running;
}
