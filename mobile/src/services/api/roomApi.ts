import { api, unwrap } from './apiClient';
import type { BoardSize, Game, Room } from './types';

export const roomApi = {
  create: (boardSize: BoardSize = 3, winLength?: number) => unwrap<Room>(api.post('/rooms', { boardSize, winLength })),
  join: (code: string) => unwrap<Room>(api.post('/rooms/join', { code: code.trim().toUpperCase() })),
  get: (id: string) => unwrap<Room>(api.get(`/rooms/${id}`)),
  leave: (id: string) => unwrap<Room>(api.post(`/rooms/${id}/leave`)),
  ready: (id: string, ready: boolean) => unwrap<Room>(api.post(`/rooms/${id}/ready`, { ready })),
  start: (id: string) => unwrap<{ room: Room; game: Game }>(api.post(`/rooms/${id}/start`)),
  invite: (id: string, friendId: string) => unwrap<{ invited: true; roomCode: string }>(api.post(`/rooms/${id}/invite`, { friendId })),
};
