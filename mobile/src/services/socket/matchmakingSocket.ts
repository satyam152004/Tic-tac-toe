import type { BoardSize, EntryAmount, FirstMovePref, Game, Room } from '../api/types';
import { socketClient } from './socketClient';

export const matchmakingSocket = {
  join: (boardSize: BoardSize = 3, winLength?: number, firstMove: FirstMovePref = 'RANDOM', entryAmount: EntryAmount = 0) =>
    socketClient.request<{ status: 'QUEUED' | 'MATCHED'; ticket: { id: string }; alreadyQueued?: boolean; game?: Game }>('matchmaking:join', {
      boardSize,
      winLength,
      firstMove,
      entryAmount,
    }),
  cancel: () => socketClient.request<{ cancelled: boolean }>('matchmaking:cancel'),
};

export const roomSocket = {
  create: (boardSize: BoardSize = 3, winLength?: number, firstMove: FirstMovePref = 'RANDOM') => socketClient.request<Room>('room:create', { boardSize, winLength, firstMove }),
  join: (code: string) => socketClient.request<Room>('room:join', { code: code.trim().toUpperCase() }),
  leave: (roomId: string) => socketClient.request<Room>('room:leave', { roomId }),
  ready: (roomId: string, ready: boolean) => socketClient.request<Room>('room:ready', { roomId, ready }),
  start: (roomId: string) => socketClient.request<{ room: Room; game: Game }>('room:start', { roomId }),
};
