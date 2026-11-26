import React, { useEffect, useState } from 'react';
import { GameReplayView, ReplayCell, ReplayStatus } from '../../components/game/GameReplayView';
import { useReplay } from '../../hooks/queries';
import { toApiError, friendlyMessage } from '../../services/api/errors';

/** Server-recorded replay of a finished online game, stepped move by move. Draws through the shared GameReplayView. */
export const ReplaySheet: React.FC<{ gameId: string | null; onClose: () => void }> = ({ gameId, onClose }) => {
  const q = useReplay(gameId ?? undefined);
  const [step, setStep] = useState(0);
  useEffect(() => {
    setStep(0);
  }, [gameId]);

  const replay = q.data;
  const total = replay?.frames.length ?? 0;
  // Start on the final position so the result is visible immediately.
  useEffect(() => {
    if (replay) setStep(replay.frames.length);
  }, [replay]);

  const g = replay?.game;
  const size = g?.boardSize ?? 3;
  const subtitle = !g
    ? ''
    : g.type === 'AI'
      ? `vs AI ${(g.difficulty ?? 'MEDIUM').charAt(0) + (g.difficulty ?? 'MEDIUM').slice(1).toLowerCase()} • ${size}×${size}`
      : g.type === 'LOCAL'
        ? `Pass & Play • ${size}×${size}`
        : `Online • ${size}×${size}`;

  let status: ReplayStatus;
  if (q.error) {
    const err = toApiError(q.error);
    status = { kind: 'error', offline: err.code === 'NETWORK_ERROR', message: friendlyMessage(err), onRetry: () => void q.refetch() };
  } else if (replay && total === 0) {
    status = { kind: 'empty' };
  } else if (replay) {
    const frame = step > 0 ? replay.frames[step - 1] : null;
    const board: ReplayCell[] = step === 0 ? Array<ReplayCell>(size * size).fill('') : ((replay.frames[step - 1]?.board ?? []) as ReplayCell[]);
    status = {
      kind: 'ready',
      subtitle,
      board,
      size,
      winningLine: replay.game.result?.line ?? null,
      lastMoveIndex: frame?.position ?? null,
      step,
      total,
      onPrev: () => setStep((n) => Math.max(0, n - 1)),
      onNext: () => setStep((n) => Math.min(total, n + 1)),
    };
  } else {
    status = { kind: 'loading' };
  }

  return <GameReplayView open={!!gameId} onClose={onClose} status={status} />;
};
