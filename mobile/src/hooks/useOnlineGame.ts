import { useEffect, useMemo, useRef, useState } from 'react';
import { userApi } from '../services/api/userApi';
import type { Game, Mark, PlayerCard } from '../services/api/types';
import { useAuthStore } from '../store/authStore';
import { isTerminal, useOnlineStore } from '../store/onlineStore';

/** Seconds remaining until an absolute time (ms epoch). Display only: the server enforces every deadline. */
export function useCountdown(targetMs: number | null | undefined): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!targetMs) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [targetMs]);
  if (!targetMs) return null;
  return Math.max(0, Math.ceil((targetMs - now) / 1000));
}

export const formatClock = (sec: number): string => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

/**
 * Device-clock deadline (ms) for the current turn, corrected for clock skew: the remaining time is measured on the
 * server clock (`turnDeadline - serverTime`) and anchored at the moment the snapshot was received.
 */
export function turnDeadlineMs(game: Game | null, receivedAt: number): number | null {
  if (!game || game.status !== 'IN_PROGRESS' || !game.turnDeadline) return null;
  const left = Date.parse(game.turnDeadline) - Date.parse(game.serverTime);
  return Number.isFinite(left) ? receivedAt + left : null;
}

export const myMarkOf = (game: Game | null, myId: string | undefined): Mark | null => game?.players.find((p) => p.userId === myId)?.mark ?? null;

/** Derived, render-only selectors over the server-authoritative online game. */
export function useOnlineGame() {
  const game = useOnlineStore((s) => s.game);
  const cards = useOnlineStore((s) => s.cards);
  const pendingMove = useOnlineStore((s) => s.pendingMove);
  const me = useAuthStore((s) => s.user);

  const received = useRef<{ game: Game | null; at: number }>({ game: null, at: Date.now() });
  if (received.current.game !== game) received.current = { game, at: Date.now() };

  const myMark = myMarkOf(game, me?.id);
  const opponent = game?.players.find((p) => p.userId !== me?.id) ?? null;
  const opponentId = opponent?.userId ?? null;
  const isMyTurn = !!game && game.status === 'IN_PROGRESS' && !!myMark && game.currentTurn === myMark;
  const canMove = isMyTurn && !pendingMove;
  const opponentCard: PlayerCard | null = opponentId ? cards[opponentId] ?? null : null;
  const secondsLeft = useCountdown(turnDeadlineMs(game, received.current.at));

  // Fetch the opponent's public card when the socket did not deliver it.
  useEffect(() => {
    if (!opponentId || opponentCard) return;
    let cancelled = false;
    userApi
      .get(opponentId)
      .then((p) => {
        if (cancelled) return;
        useOnlineStore.getState().setCards([{ id: p.id, username: p.username, displayName: p.displayName, avatar: p.avatar, level: p.stats.level, online: p.online }]);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [opponentId, opponentCard]);

  return useMemo(
    () => ({ game, me, myMark, opponent, opponentId, opponentCard, isMyTurn, canMove, secondsLeft, finished: !!game && isTerminal(game) }),
    [game, me, myMark, opponent, opponentId, opponentCard, isMyTurn, canMove, secondsLeft],
  );
}
