import { gameApi } from './api/gameApi';
import { feedback } from './feedback';
import { roomApi } from './api/roomApi';
import { toApiError } from './api/errors';
import type { BoardSize, EntryAmount, FirstMovePref, Game, Room } from './api/types';
import { useOnlineStore } from '../store/onlineStore';
import { gameSocket } from './socket/gameSocket';
import { matchmakingSocket, roomSocket } from './socket/matchmakingSocket';
import { socketClient } from './socket/socketClient';

/**
 * User intents for online play. The CLIENT NEVER DECIDES RESULTS: every action goes to the server, which validates and
 * answers with the authoritative game state that is applied to the store. Socket first, REST as fallback.
 */
const store = () => useOnlineStore.getState();

export async function submitMove(position: number): Promise<void> {
  const s = store();
  const game = s.game;
  if (!game || s.pendingMove || game.status !== 'IN_PROGRESS') return; // blocks duplicate submissions
  s.setPending(true);
  s.setMoveError(null);
  // Sound is immediate (before the server answers). The server's game:updated event skips our own moves, so no double cue.
  if (game.board[position] === '') feedback.place(game.currentTurn);
  const clientMoveId = socketClient.newId();
  try {
    const res = socketClient.connected
      ? await gameSocket.move(game.id, position, clientMoveId, game.moveCount + 1)
      : await gameApi.move(game.id, position, clientMoveId);
    store().applyGame(res.game, res.aiMove?.position ?? res.move.position);
  } catch (e) {
    const err = toApiError(e);
    store().setMoveError({ code: err.code, message: err.message, at: Date.now() });
    // The board may have moved on without us (MOVE_CONFLICT / NOT_YOUR_TURN): re-sync from the server.
    if (err.code === 'MOVE_CONFLICT' || err.code === 'NOT_YOUR_TURN') {
      await gameApi.get(game.id).then((g) => store().applyGame(g)).catch(() => undefined);
    }
  } finally {
    store().setPending(false);
  }
}

export async function startQuickMatch(boardSize: BoardSize, firstMove: FirstMovePref = 'RANDOM', entryAmount: EntryAmount = 0): Promise<{ status: 'QUEUED' | 'MATCHED'; game?: Game }> {
  store().setMatchmaking({ phase: 'searching', boardSize, startedAt: Date.now(), cancelReason: null });
  try {
    await socketClient.whenReady(6000).catch(() => undefined);
    const r = socketClient.connected
      ? await matchmakingSocket.join(boardSize, undefined, firstMove, entryAmount)
      : await import('./api/matchmakingApi').then((m) => m.matchmakingApi.join(boardSize, undefined, firstMove, entryAmount));
    if (r.status === 'MATCHED' && r.game) {
      store().applyGame(r.game);
      store().setMatchmaking({ phase: 'found', startedAt: null });
    }
    return r;
  } catch (e) {
    store().setMatchmaking({ phase: 'idle', startedAt: null });
    throw e;
  }
}

export async function cancelQuickMatch(): Promise<void> {
  store().setMatchmaking({ phase: 'idle', startedAt: null });
  try {
    if (socketClient.connected) await matchmakingSocket.cancel();
    else await import('./api/matchmakingApi').then((m) => m.matchmakingApi.cancel());
  } catch {
    /* already left / expired */
  }
}

export async function createRoom(boardSize: BoardSize): Promise<Room> {
  const room = await roomApi.create(boardSize);
  store().setRoom(room);
  return room;
}

export async function joinRoomByCode(code: string): Promise<Room> {
  const room = await roomApi.join(code);
  store().setRoom(room);
  return room;
}

export async function setReady(roomId: string, ready: boolean): Promise<Room> {
  const room = await roomApi.ready(roomId, ready);
  store().setRoom(room);
  return room;
}

export async function startRoomGame(roomId: string): Promise<Game> {
  const { room, game } = await roomApi.start(roomId);
  store().setRoom(room);
  store().applyGame(game);
  return game;
}

export async function leaveRoom(roomId: string): Promise<void> {
  try {
    await roomApi.leave(roomId);
  } finally {
    store().setRoom(null);
  }
}

export async function joinGame(gameId: string): Promise<Game> {
  const g = socketClient.connected ? await gameSocket.join(gameId) : await gameApi.join(gameId);
  store().applyGame(g);
  return g;
}

export async function forfeitGame(gameId: string): Promise<Game> {
  const g = socketClient.connected ? await gameSocket.forfeit(gameId) : await gameApi.forfeit(gameId);
  store().applyGame(g);
  return g;
}

export async function requestRematch(gameId: string): Promise<'REQUESTED' | 'STARTED'> {
  const r = socketClient.connected ? await gameSocket.rematch(gameId) : await gameApi.rematch(gameId);
  if (r.status === 'STARTED') {
    store().clearGame();
    store().applyGame(r.game);
    store().setRematchGameId(r.game.id);
  } else {
    store().setRematch({ requestedByMe: true });
  }
  return r.status;
}

/** Loads a game from the server into the store (deep links, notifications, "resume"). */
export async function openGame(gameId: string): Promise<Game> {
  const g = await gameApi.get(gameId);
  store().applyGame(g);
  return g;
}
