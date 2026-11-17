import { create } from 'zustand';
import {
  BoardSize,
  Difficulty,
  LocalGameState,
  Mark,
  MoveError,
  getElapsedMs,
  isAiTurn,
  newLocalGame,
  pauseTimer,
  playAiMove,
  playMove,
  restart,
  resumeTimer,
  toMatchRecord,
  undo,
} from '../game-engine';
import { feedback } from '../services/feedback';
import { ActiveLocalGame, localGameStorage } from '../services/storage/localGameStorage';

export interface LocalSetup {
  mode: 'LOCAL_2P' | 'VS_AI';
  size: BoardSize;
  winLength?: number;
  difficulty: Difficulty;
  p1Name: string;
  p2Name: string;
  p1Avatar: string;
  p2Avatar: string;
  /** Mark chosen by player 1 (the human in VS_AI). X always moves first. */
  p1Mark: Mark;
}

export const DEFAULT_SETUP: LocalSetup = {
  mode: 'LOCAL_2P',
  size: 3,
  difficulty: 'MEDIUM',
  p1Name: 'Player 1',
  p2Name: 'Player 2',
  p1Avatar: 'av_1',
  p2Avatar: 'av_2',
  p1Mark: 'X',
};

interface LocalGameStore {
  setup: LocalSetup;
  game: LocalGameState | null;
  paused: boolean;
  /** clientMatchId of the last finished + stored match (so the result screen can reference it). */
  lastMatchId: string | null;
  /** Bumped whenever a finished match is stored; History / sync listen to it. */
  historyVersion: number;
  lastMove: number | null;

  configure: (patch: Partial<LocalSetup>) => void;
  start: () => void;
  resume: (active: ActiveLocalGame) => void;
  play: (position: number) => boolean;
  aiMove: () => void;
  undoMove: () => void;
  rematch: () => void;
  pause: () => void;
  unpause: () => void;
  quit: () => void;
  elapsedMs: () => number;
}

/**
 * Offline game store. The rules/AI live in the shared engine (src/game-engine, a parity-tested copy of the backend's
 * engine); this store only sequences them, persists progress and records finished matches. No network is involved.
 */
export const useLocalGameStore = create<LocalGameStore>((set, get) => {
  const persist = (game: LocalGameState) => {
    const { setup } = get();
    const active: ActiveLocalGame = {
      state: game,
      p1Name: setup.p1Name,
      p2Name: setup.p2Name,
      p1Avatar: setup.p1Avatar,
      p2Avatar: setup.p2Avatar,
      p1Mark: setup.p1Mark,
      savedAt: Date.now(),
    };
    void localGameStorage.saveActive(active).catch(() => undefined);
  };

  const finishIfNeeded = (game: LocalGameState) => {
    if (game.outcome.status === 'IN_PROGRESS') {
      persist(game);
      return;
    }
    const { setup } = get();
    const record = toMatchRecord(game);
    const p1IsX = setup.p1Mark === 'X';
    const xName = p1IsX ? setup.p1Name : setup.p2Name;
    const oName = p1IsX ? setup.p2Name : setup.p1Name;
    void localGameStorage
      .saveMatch(record, xName, oName)
      .then((id) => set((s) => ({ lastMatchId: id, historyVersion: s.historyVersion + 1 })))
      .catch(() => undefined);
    void localGameStorage.clearActive().catch(() => undefined);
    if (game.outcome.status === 'DRAW') feedback.result('draw');
    else if (game.mode === 'VS_AI') feedback.result(game.outcome.winner === game.humanMark ? 'win' : 'lose');
    else feedback.result('win');
  };

  return {
    setup: DEFAULT_SETUP,
    game: null,
    paused: false,
    lastMatchId: null,
    historyVersion: 0,
    lastMove: null,

    configure: (patch) => set((s) => ({ setup: { ...s.setup, ...patch } })),

    start: () => {
      const { setup } = get();
      const game = newLocalGame({ mode: setup.mode, size: setup.size, winLength: setup.winLength, difficulty: setup.difficulty, humanMark: setup.p1Mark });
      set({ game, paused: false, lastMove: null, lastMatchId: null });
      persist(game);
    },

    resume: (active) => {
      set({
        setup: {
          ...get().setup,
          mode: active.state.mode,
          size: active.state.config.size,
          winLength: active.state.config.winLength,
          difficulty: active.state.difficulty ?? 'MEDIUM',
          p1Name: active.p1Name,
          p2Name: active.p2Name,
          p1Avatar: active.p1Avatar,
          p2Avatar: active.p2Avatar,
          p1Mark: active.p1Mark,
        },
        game: resumeTimer(pauseTimer(active.state)),
        paused: false,
        lastMove: active.state.moves[active.state.moves.length - 1]?.position ?? null,
      });
    },

    /** Returns false when the move was illegal (occupied cell, game finished, paused, AI's turn). */
    play: (position) => {
      const { game, paused } = get();
      if (!game || paused || game.outcome.status !== 'IN_PROGRESS' || isAiTurn(game)) return false;
      try {
        const next = playMove(game, position);
        feedback.place(game.current);
        set({ game: next, lastMove: position });
        finishIfNeeded(next);
        return true;
      } catch (e) {
        if (e instanceof MoveError) {
          feedback.error();
          return false;
        }
        throw e;
      }
    },

    aiMove: () => {
      const { game, paused } = get();
      if (!game || paused || !isAiTurn(game)) return;
      const mark = game.current;
      const next = playAiMove(game);
      feedback.place(mark);
      set({ game: next, lastMove: next.moves[next.moves.length - 1]?.position ?? null });
      finishIfNeeded(next);
    },

    undoMove: () => {
      const { game, paused } = get();
      if (!game || paused || game.moves.length === 0) return;
      const next = undo(game);
      set({ game: next, lastMove: next.moves[next.moves.length - 1]?.position ?? null });
      persist(next);
    },

    /** New round, same players and running scores. */
    rematch: () => {
      const { game } = get();
      if (!game) return;
      const next = restart(game);
      set({ game: next, paused: false, lastMove: null, lastMatchId: null });
      persist(next);
    },

    pause: () => {
      const { game } = get();
      if (!game || game.outcome.status !== 'IN_PROGRESS') return;
      set({ game: pauseTimer(game), paused: true });
    },

    unpause: () => {
      const { game } = get();
      if (!game) return;
      set({ game: resumeTimer(game), paused: false });
    },

    quit: () => {
      set({ game: null, paused: false, lastMove: null });
      void localGameStorage.clearActive().catch(() => undefined);
    },

    elapsedMs: () => {
      const { game } = get();
      return game ? getElapsedMs(game) : 0;
    },
  };
});

/** Helper for screens: who is who. X always moves first; player 1 may have picked O. */
export function seatsOf(setup: LocalSetup): { X: { name: string; avatar: string; isP1: boolean }; O: { name: string; avatar: string; isP1: boolean } } {
  const p1 = { name: setup.p1Name, avatar: setup.p1Avatar, isP1: true };
  const p2 = { name: setup.mode === 'VS_AI' ? 'Vortex AI' : setup.p2Name, avatar: setup.mode === 'VS_AI' ? 'av_ai' : setup.p2Avatar, isP1: false };
  return setup.p1Mark === 'X' ? { X: p1, O: p2 } : { X: p2, O: p1 };
}
