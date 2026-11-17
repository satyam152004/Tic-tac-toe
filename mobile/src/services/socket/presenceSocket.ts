import { socketClient } from './socketClient';

/** Friend presence events: `player:connected` / `player:disconnected` ({ userId }) for FRIENDS, delivered automatically. */
export const presenceSocket = {
  onFriendOnline: (fn: (userId: string) => void) => socketClient.on('player:connected', (p) => fn(p.userId)),
  onFriendOffline: (fn: (userId: string) => void) =>
    socketClient.on('player:disconnected', (p) => {
      if (!p.gameId) fn(p.userId); // with gameId it is an opponent-in-game event, not friend presence
    }),
};
