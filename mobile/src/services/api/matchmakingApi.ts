import { api, unwrap } from './apiClient';
import type { BoardSize, EntryAmount, FirstMovePref, Game, MatchmakingStatus } from './types';

export const matchmakingApi = {
  join: (boardSize: BoardSize = 3, winLength?: number, firstMove: FirstMovePref = 'RANDOM', entryAmount: EntryAmount = 0) =>
    unwrap<{ status: 'QUEUED' | 'MATCHED'; ticket: { id: string }; game?: Game; alreadyQueued?: boolean }>(
      api.post('/matchmaking/join', { boardSize, winLength, firstMove, entryAmount }),
    ),
  cancel: () => unwrap<{ cancelled: boolean }>(api.post('/matchmaking/cancel')),
  status: () => unwrap<MatchmakingStatus>(api.get('/matchmaking/status')),
};
