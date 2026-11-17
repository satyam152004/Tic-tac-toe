import { api, unwrap } from './apiClient';
import type { BoardSize, Difficulty, Game, MoveResult, Replay } from './types';

/** Online/server-side games. Offline games never touch the network (see src/game-engine + localGameStorage). */
export const gameApi = {
  createVsServerAi: (input: { boardSize: BoardSize; difficulty: Difficulty; winLength?: number; humanMark?: 'X' | 'O' | 'RANDOM' }) =>
    unwrap<Game>(api.post('/games', { type: 'AI', ...input })),
  /** Invite a friend to a game (they accept with POST /games/:id/join). */
  inviteFriend: (input: { opponentId: string; boardSize: BoardSize; winLength?: number }) => unwrap<Game>(api.post('/games', { type: 'FRIEND', ...input })),
  get: (id: string) => unwrap<Game>(api.get(`/games/${id}`)),
  active: () => unwrap<Game[]>(api.get('/games/active')),
  join: (id: string) => unwrap<Game>(api.post(`/games/${id}/join`)),
  /** REST fallback for moves when the socket is down. Reuse `clientMoveId` on retries (idempotent). */
  move: (gameId: string, position: number, clientMoveId: string) => unwrap<MoveResult>(api.post(`/games/${gameId}/moves`, { position, clientMoveId })),
  forfeit: (id: string) => unwrap<Game>(api.post(`/games/${id}/forfeit`)),
  rematch: (id: string) => unwrap<{ status: 'REQUESTED' | 'STARTED'; game: Game }>(api.post(`/games/${id}/rematch`)),
  replay: (id: string) => unwrap<Replay>(api.get(`/games/${id}/replay`)),
};
