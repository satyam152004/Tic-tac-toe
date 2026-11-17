import { create } from 'zustand';
import type { BoardSize, Game, PlayerCard, Room } from '../services/api/types';

export type MatchmakingPhase = 'idle' | 'searching' | 'found';

interface OnlineState {
  /** Last authoritative state received from the server for the game being played/viewed. */
  game: Game | null;
  cards: Record<string, PlayerCard>;
  lastMove: number | null;
  /** Set while a move is in flight; the board is locked so a double tap can never send two moves. */
  pendingMove: boolean;
  moveError: { code: string; message: string; at: number } | null;
  /** Opponent lost connection: the server forfeits them after `graceSeconds` unless they return. */
  opponentOffline: { userId: string; graceSeconds: number; since: number } | null;
  rematch: { requestedByMe: boolean; requestedByOpponent: boolean };
  /** Set when the server starts a rematch game: the UI navigates to it. */
  rematchGameId: string | null;

  matchmaking: { phase: MatchmakingPhase; boardSize: BoardSize; startedAt: number | null; cancelReason: 'CANCELLED' | 'EXPIRED' | null };
  room: Room | null;
  roomEnded: 'EXPIRED' | 'CANCELLED' | null;
  /** True after a socket drop until the server re-sent the session (drives the "Reconnecting" screen). */
  reconnecting: boolean;

  applyGame: (g: Game, lastMove?: number | null) => void;
  setCards: (cards: PlayerCard[]) => void;
  setPending: (v: boolean) => void;
  setMoveError: (e: OnlineState['moveError']) => void;
  setOpponentOffline: (v: OnlineState['opponentOffline']) => void;
  setRematch: (patch: Partial<OnlineState['rematch']>) => void;
  setRematchGameId: (id: string | null) => void;
  setMatchmaking: (patch: Partial<OnlineState['matchmaking']>) => void;
  setRoom: (r: Room | null) => void;
  setRoomEnded: (v: OnlineState['roomEnded']) => void;
  setReconnecting: (v: boolean) => void;
  clearGame: () => void;
  reset: () => void;
}

const TERMINAL = new Set(['COMPLETED', 'DRAW', 'CANCELLED', 'EXPIRED']);
export const hasOutcomes = (g: Pick<Game, 'players'>): boolean => g.players.length > 0 && g.players.every((p) => p.outcome !== null);
export const isTerminal = (g: Pick<Game, 'status'>): boolean => TERMINAL.has(g.status);

const initial = {
  game: null,
  cards: {},
  lastMove: null,
  pendingMove: false,
  moveError: null,
  opponentOffline: null,
  rematch: { requestedByMe: false, requestedByOpponent: false },
  rematchGameId: null,
  matchmaking: { phase: 'idle' as MatchmakingPhase, boardSize: 3 as BoardSize, startedAt: null, cancelReason: null },
  room: null,
  roomEnded: null,
  reconnecting: false,
};

export const useOnlineStore = create<OnlineState>((set, get) => ({
  ...initial,

  /**
   * Applies a server snapshot. Snapshots are monotonic (moveCount only grows, terminal states are final), so a late or
   * duplicated event can never roll the board back.
   */
  applyGame: (g, lastMove) => {
    const cur = get().game;
    if (cur && cur.id === g.id) {
      if (isTerminal(cur) && !isTerminal(g)) return;
      if (!isTerminal(g) && g.moveCount < cur.moveCount) return;
      // A finalized snapshot (outcomes + points) must never be replaced by an earlier terminal one that lacks them
      // (e.g. a move ack that raced with the game:finished event).
      if (isTerminal(cur) && isTerminal(g) && hasOutcomes(cur) && !hasOutcomes(g)) return;
    }
    const sameGame = cur?.id === g.id;
    set({
      game: g,
      lastMove: lastMove ?? (g.moveCount > 0 && sameGame && cur ? (get().lastMove ?? null) : null),
      ...(sameGame ? null : { opponentOffline: null, rematch: { requestedByMe: false, requestedByOpponent: false }, rematchGameId: null, moveError: null }),
      ...(isTerminal(g) ? { pendingMove: false, opponentOffline: null } : null),
    });
  },
  setCards: (cards) => set((s) => ({ cards: { ...s.cards, ...Object.fromEntries(cards.map((c) => [c.id, c])) } })),
  setPending: (v) => set({ pendingMove: v }),
  setMoveError: (e) => set({ moveError: e }),
  setOpponentOffline: (v) => set({ opponentOffline: v }),
  setRematch: (patch) => set((s) => ({ rematch: { ...s.rematch, ...patch } })),
  setRematchGameId: (id) => set({ rematchGameId: id }),
  setMatchmaking: (patch) => set((s) => ({ matchmaking: { ...s.matchmaking, ...patch } })),
  setRoom: (r) => set({ room: r, roomEnded: null }),
  setRoomEnded: (v) => set({ roomEnded: v }),
  setReconnecting: (v) => set({ reconnecting: v }),
  clearGame: () => set({ game: null, lastMove: null, pendingMove: false, moveError: null, opponentOffline: null, rematch: { requestedByMe: false, requestedByOpponent: false }, rematchGameId: null }),
  reset: () => set({ ...initial }),
}));
