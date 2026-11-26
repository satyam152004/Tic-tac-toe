import type { GameType } from './api/types';

/** Which Match found source a game belongs to (undefined = ranked, the most common case). */
export type MatchFoundSource = 'RANKED' | 'FRIEND' | 'ROOM';
export const matchFoundSource = (type?: GameType): MatchFoundSource =>
  type === 'PRIVATE_ROOM' ? 'ROOM' : type === 'FRIEND' ? 'FRIEND' : 'RANKED';

/** Not started yet (a friend has not accepted, or both players are seated): these open Match found first. */
export const isPreStart = (g: { status: string }): boolean => g.status === 'WAITING' || g.status === 'READY';
