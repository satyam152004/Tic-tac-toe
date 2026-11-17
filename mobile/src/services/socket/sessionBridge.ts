import { queryClient } from '../queryClient';
import { gameApi } from '../api/gameApi';
import { toApiError } from '../api/errors';
import type { Game } from '../api/types';
import { useAuthStore } from '../../store/authStore';
import { isTerminal, useOnlineStore } from '../../store/onlineStore';
import { toast } from '../../store/toastStore';
import { feedback } from '../feedback';
import { gameSocket } from './gameSocket';
import { socketClient } from './socketClient';

/**
 * Wires every server->client event into the stores, ONCE per signed-in session (call attachSession() when the user
 * signs in and the returned detach() on sign-out). Handlers only mutate stores; screens react to the stores.
 * Event names/payloads are exactly the backend's (docs/SOCKET_EVENTS.md).
 */
export function attachSession(): () => void {
  const store = () => useOnlineStore.getState();
  const myId = () => useAuthStore.getState().user?.id;
  const offs: Array<() => void> = [];
  const on = socketClient.on.bind(socketClient);

  const applyFromServer = (game: Game, lastMove?: number | null) => store().applyGame(game, lastMove);
  const finish = (game: Game) => {
    applyFromServer(game);
    const me = game.players.find((p) => p.userId === myId());
    if (game.status === 'DRAW') feedback.result('draw');
    else if (me?.outcome === 'WIN') feedback.result('win');
    else if (me?.outcome === 'LOSS') feedback.result('lose');
    // stats/leaderboard/history changed on the server
    void queryClient.invalidateQueries({ queryKey: ['me'] });
    void queryClient.invalidateQueries({ queryKey: ['stats'] });
    void queryClient.invalidateQueries({ queryKey: ['history'] });
    void queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    void queryClient.invalidateQueries({ queryKey: ['achievements'] });
  };

  offs.push(
    on('session:ready', async ({ activeGames }) => {
      const wasReconnecting = store().reconnecting;
      store().setReconnecting(false);
      // Restore the latest server state of the game we were in (the server also pushes game:updated {resumed:true}).
      const cur = store().game;
      const active = activeGames.find((g) => g.status === 'IN_PROGRESS' || g.status === 'READY' || g.status === 'WAITING');
      if (cur && !isTerminal(cur)) {
        try {
          applyFromServer(await gameApi.get(cur.id));
          if (wasReconnecting) await gameSocket.join(cur.id).catch(() => undefined); // re-enter the game channel
        } catch (e) {
          if (toApiError(e).code !== 'NETWORK_ERROR') store().clearGame();
        }
      } else if (!cur && active) {
        applyFromServer(active);
      }
      void queryClient.invalidateQueries({ queryKey: ['friends'] });
    }),

    on('matchmaking:queued', () => store().setMatchmaking({ phase: 'searching', startedAt: store().matchmaking.startedAt ?? Date.now(), cancelReason: null })),
    on('matchmaking:cancelled', ({ reason }) => store().setMatchmaking({ phase: 'idle', startedAt: null, cancelReason: reason })),
    on('matchmaking:found', async ({ game, opponent }) => {
      if (opponent) store().setCards([opponent]);
      applyFromServer(game);
      store().setMatchmaking({ phase: 'found', startedAt: null });
      try {
        // "You are already in the game channel. Confirm with game:join" (backend contract)
        applyFromServer(await gameSocket.join(game.id));
      } catch {
        /* the game:started event will still arrive; the board screen re-joins on mount */
      }
    }),

    on('game:started', ({ game, players }) => {
      const cards = players.map((p) => p.user).filter((u): u is NonNullable<typeof u> => !!u);
      if (cards.length) store().setCards(cards);
      applyFromServer(game);
    }),
    on('game:updated', ({ game, lastMove }) => {
      const before = store().game;
      applyFromServer(game, lastMove?.position ?? null);
      if (lastMove && lastMove.playerId !== myId() && before?.id === game.id) feedback.place(lastMove.mark);
      store().setPending(false);
    }),
    on('game:finished', ({ game }) => finish(game)),
    on('game:draw', ({ game }) => finish(game)),
    on('game:move-rejected', ({ code, message }) => {
      store().setPending(false);
      store().setMoveError({ code, message, at: Date.now() });
      feedback.error();
    }),

    on('game:rematch-requested', () => store().setRematch({ requestedByOpponent: true })),
    on('game:rematch-accepted', ({ game }) => {
      store().clearGame();
      applyFromServer(game);
      store().setRematchGameId(game.id);
    }),

    on('player:disconnected', ({ userId, gameId, graceSeconds }) => {
      if (gameId && gameId === store().game?.id && userId !== myId()) {
        store().setOpponentOffline({ userId, graceSeconds: graceSeconds ?? 30, since: Date.now() });
      }
    }),
    on('player:reconnected', ({ gameId, userId }) => {
      if (gameId === store().game?.id && userId !== myId()) store().setOpponentOffline(null);
    }),

    on('room:created', ({ room }) => store().setRoom(room)),
    on('room:updated', ({ room }) => {
      if (store().room?.id === room.id || !store().room) store().setRoom(room);
    }),
    on('room:expired', ({ roomId, reason }) => {
      if (store().room?.id === roomId) {
        store().setRoomEnded(reason === 'CANCELLED' ? 'CANCELLED' : 'EXPIRED');
        store().setRoom(null);
        store().setRoomEnded(reason === 'CANCELLED' ? 'CANCELLED' : 'EXPIRED');
      }
    }),

    on('notification:new', (n) => {
      toast.info(n.title, n.body);
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      if (n.category === 'social') void queryClient.invalidateQueries({ queryKey: ['friends'] });
    }),
    on('player:level-up', ({ level }) => {
      toast.success('Level up!', `You reached level ${level}`);
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    }),
    on('player:achievement-unlocked', ({ name }) => {
      toast.success('Achievement unlocked', name);
      void queryClient.invalidateQueries({ queryKey: ['achievements'] });
    }),
    on('friends:updated', () => void queryClient.invalidateQueries({ queryKey: ['friends'] })),
    on('player:connected', () => void queryClient.invalidateQueries({ queryKey: ['friends'] })),
  );

  // Connection status -> "reconnecting" flag
  offs.push(
    socketClient.onStatus((s) => {
      if (s === 'reconnecting' && store().game && !isTerminal(store().game!)) store().setReconnecting(true);
    }),
  );

  return () => {
    offs.forEach((o) => o());
    store().reset();
  };
}
