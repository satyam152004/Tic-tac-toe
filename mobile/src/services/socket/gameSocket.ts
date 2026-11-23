import { toApiError } from '../api/errors';
import type { CheerKind, Game, MoveResult, SpectateSnapshot } from '../api/types';
import { socketClient } from './socketClient';

/** Exact events/payloads from the backend (docs/SOCKET_EVENTS.md). */
export const gameSocket = {
  join: (gameId: string) => socketClient.request<Game>('game:join', { gameId }),
  forfeit: (gameId: string) => socketClient.request<Game>('game:forfeit', { gameId }),
  spectate: (gameId: string) => socketClient.request<SpectateSnapshot>('game:spectate', { gameId }),
  unspectate: (gameId: string) => socketClient.request<{ left: true }>('game:unspectate', { gameId }),
  cheer: (gameId: string, kind: CheerKind) => socketClient.request<{ sent: true }>('game:cheer', { gameId, kind }),
  offerDraw: (gameId: string) => socketClient.request<Game>('game:offer-draw', { gameId }),
  respondDraw: (gameId: string, accept: boolean) => socketClient.request<Game>('game:respond-draw', { gameId, accept }),
  rematch: (gameId: string) => socketClient.request<{ status: 'REQUESTED' | 'STARTED'; game: Game }>('game:rematch', { gameId }),

  /**
   * Sends a move. `clientMoveId` makes retries safe: if the ack is lost, retrying with the SAME id returns the original
   * move (`duplicate: true`) instead of applying it twice. Retries only on network errors, at most twice.
   */
  async move(gameId: string, position: number, clientMoveId: string = socketClient.newId(), expectedMoveNumber?: number): Promise<MoveResult> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await socketClient.request<MoveResult>('game:move', { gameId, position, clientMoveId, expectedMoveNumber });
      } catch (e) {
        const err = toApiError(e);
        if (err.code !== 'NETWORK_ERROR' || attempt >= 2) throw err;
        await socketClient.whenReady().catch(() => undefined);
      }
    }
  },
};
