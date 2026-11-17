import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Games, syncLocalMatches } from './apiClient';
import { ApiError, friendlyMessage, toApiError } from './errors';
import { gameSocket } from './socketClient';
import { tokenStorage } from './tokenStorage';
import type { Game, Mark, PlayerCard } from './types';
import {
  Difficulty, LocalGameState, LocalMatchRecord, MoveError, newLocalGame, playAiMove, playMove, restart, toMatchRecord, undo, isAiTurn, getElapsedMs,
} from './game-engine'; // copy of backend src/game-engine (pure TS, works offline)

// =================================================================================================
// Quick matchmaking
// =================================================================================================
export type MatchState = { phase: 'idle' } | { phase: 'queued' } | { phase: 'found'; gameId: string; opponent: PlayerCard | null } | { phase: 'error'; message: string };

export function useMatchmaking(boardSize: 3 | 4 | 5 = 3) {
  const [state, setState] = useState<MatchState>({ phase: 'idle' });

  useEffect(() => {
    const offFound = gameSocket.on('matchmaking:found', async ({ gameId, opponent }) => {
      setState({ phase: 'found', gameId, opponent });
      await gameSocket.joinGame(gameId).catch(() => undefined); // confirm presence -> the game starts when both joined
    });
    const offCancelled = gameSocket.on('matchmaking:cancelled', ({ reason }) => {
      setState(reason === 'EXPIRED' ? { phase: 'error', message: 'No opponent found. Try again.' } : { phase: 'idle' });
    });
    return () => {
      offFound();
      offCancelled();
    };
  }, []);

  const join = useCallback(async () => {
    try {
      await gameSocket.whenReady();
      const res = await gameSocket.joinQueue(boardSize);
      if (res.status === 'QUEUED') setState({ phase: 'queued' }); // 'found' arrives as an event
    } catch (e) {
      setState({ phase: 'error', message: friendlyMessage(toApiError(e)) });
    }
  }, [boardSize]);

  const cancel = useCallback(async () => {
    await gameSocket.cancelQueue().catch(() => undefined);
    setState({ phase: 'idle' });
  }, []);

  return { state, join, cancel };
}

// =================================================================================================
// Live online game (server is the source of truth; the UI only renders what it is told)
// =================================================================================================
export function useOnlineGame(gameId: string, myUserId: string) {
  const [game, setGame] = useState<Game | null>(null);
  const [connected, setConnected] = useState(true);
  const [opponentOnline, setOpponentOnline] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rematch, setRematch] = useState<'none' | 'requested' | 'incoming'>('none');
  const pendingMoveId = useRef<string | null>(null);

  // initial state + resume. REST gives the state even if the socket is still connecting.
  const reload = useCallback(async () => {
    try {
      setGame(await Games.get(gameId));
    } catch (e) {
      setError(friendlyMessage(toApiError(e)));
    }
  }, [gameId]);

  useEffect(() => {
    void reload();
    gameSocket.whenReady().then(() => gameSocket.joinGame(gameId)).catch(() => undefined);

    const offs = [
      gameSocket.on('game:started', (p) => p.game.id === gameId && setGame(p.game)),
      // every accepted move, forfeit, timeout... and the state replay after a reconnect (`resumed`)
      gameSocket.on('game:updated', (p) => p.game.id === gameId && setGame((cur) => (!cur || p.game.moveCount >= cur.moveCount ? p.game : cur))),
      gameSocket.on('game:finished', (p) => p.game.id === gameId && setGame(p.game)),
      gameSocket.on('game:draw', (p) => p.game.id === gameId && setGame(p.game)),
      gameSocket.on('game:move-rejected', (p) => {
        if (p.gameId !== gameId) return;
        pendingMoveId.current = null;
        setError(friendlyMessage(new ApiError(p.code, p.message)));
        void reload(); // roll back any optimistic UI to the server truth
      }),
      gameSocket.on('player:disconnected', (p) => p.gameId === gameId && p.userId !== myUserId && setOpponentOnline(false)),
      gameSocket.on('player:reconnected', (p) => p.gameId === gameId && p.userId !== myUserId && setOpponentOnline(true)),
      gameSocket.on('game:rematch-requested', (p) => p.gameId === gameId && setRematch('incoming')),
      gameSocket.on('game:rematch-accepted', (p) => p.previousGameId === gameId && setGame(p.game)), // navigate to p.game.id
      gameSocket.on('session:ready', () => {
        setConnected(true);
        void reload(); // after a reconnect, re-sync with the server (it also pushes game:updated {resumed:true})
      }),
    ];
    return () => offs.forEach((o) => o());
  }, [gameId, myUserId, reload]);

  const myMark: Mark | null = useMemo(() => (game?.players.find((p) => p.userId === myUserId)?.mark ?? null), [game, myUserId]);
  const myTurn = !!game && game.status === 'IN_PROGRESS' && game.currentTurn === myMark;

  const play = useCallback(
    async (position: number) => {
      if (!game || !myTurn || game.board[position] !== '') return;
      setError(null);
      try {
        const res = await gameSocket.sendMove(game.id, position); // retries with the same clientMoveId on flaky networks
        setGame(res.game);
      } catch (e) {
        setError(friendlyMessage(toApiError(e)));
      }
    },
    [game, myTurn],
  );

  return {
    game, myMark, myTurn, connected, opponentOnline, error, rematch, play,
    forfeit: () => gameSocket.forfeit(gameId),
    requestRematch: async () => {
      const r = await gameSocket.rematch(gameId);
      setRematch(r.status === 'REQUESTED' ? 'requested' : 'none');
      return r;
    },
  };
}

// =================================================================================================
// Offline game: no backend, no network (same engine the server uses)
// =================================================================================================
const HISTORY_KEY = 'offline.history.v1';
const UNSYNCED_KEY = 'offline.unsynced.v1';

type Action = { type: 'play'; position: number } | { type: 'ai' } | { type: 'undo' } | { type: 'restart' };

export function useOfflineGame(opts: { size?: 3 | 4 | 5; winLength?: number; mode: 'LOCAL_2P' | 'VS_AI'; difficulty?: Difficulty }) {
  const [state, dispatch] = useReducer((s: LocalGameState, a: Action): LocalGameState => {
    try {
      switch (a.type) {
        case 'play': return playMove(s, a.position);
        case 'ai': return playAiMove(s);
        case 'undo': return undo(s);
        case 'restart': return restart(s);
      }
    } catch (e) {
      if (e instanceof MoveError) return s; // ignore illegal taps
      throw e;
    }
  }, undefined, () => newLocalGame(opts));

  // let the AI answer after a short, human-feeling delay
  useEffect(() => {
    if (!isAiTurn(state)) return;
    const t = setTimeout(() => dispatch({ type: 'ai' }), 350);
    return () => clearTimeout(t);
  }, [state]);

  // persist finished matches locally (offline history) and queue them for server verification
  const saved = useRef<number | null>(null);
  useEffect(() => {
    if (state.outcome.status === 'IN_PROGRESS' || saved.current === state.startedAt) return;
    saved.current = state.startedAt;
    const record: LocalMatchRecord & { clientMatchId: string } = { ...toMatchRecord(state), clientMatchId: `local-${state.startedAt}-${Math.random().toString(36).slice(2, 10)}` };
    void (async () => {
      const history: unknown[] = JSON.parse((await AsyncStorage.getItem(HISTORY_KEY)) ?? '[]');
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify([record, ...history].slice(0, 200)));
      const unsynced: unknown[] = JSON.parse((await AsyncStorage.getItem(UNSYNCED_KEY)) ?? '[]');
      await AsyncStorage.setItem(UNSYNCED_KEY, JSON.stringify([...unsynced, record]));
    })();
  }, [state]);

  return {
    state,
    elapsedMs: () => getElapsedMs(state),
    play: (position: number) => dispatch({ type: 'play', position }),
    undo: () => dispatch({ type: 'undo' }),
    restart: () => dispatch({ type: 'restart' }),
  };
}

/** Call when the app is online and logged in (app start / network regained). Safe to call repeatedly (server dedupes). */
export async function syncOfflineMatches(): Promise<void> {
  if (!tokenStorage.current()) return;
  const raw = JSON.parse((await AsyncStorage.getItem(UNSYNCED_KEY)) ?? '[]') as Array<LocalMatchRecord & { clientMatchId: string }>;
  if (!raw.length) return;
  const batch = raw.slice(0, 50).map((r) => ({
    clientMatchId: r.clientMatchId, size: r.config.size, winLength: r.config.winLength, mode: r.mode,
    difficulty: r.difficulty, humanMark: r.humanMark, moves: r.moves, durationMs: r.durationMs, playedAt: r.playedAt,
  }));
  await syncLocalMatches(batch); // duplicates / rejected entries are fine: they must not be retried forever
  await AsyncStorage.setItem(UNSYNCED_KEY, JSON.stringify(raw.slice(50)));
}
