import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { AppModal } from '../../components/common/AppModal';
import { AppButton } from '../../components/common/AppButton';
import { GameBoard } from '../../components/game/GameBoard';
import { EmptyState, ErrorState } from '../../components/feedback/StateViews';
import { AppLoader } from '../../components/feedback/AppLoader';
import { fonts } from '../../design-system/typography';
import { useReplay } from '../../hooks/queries';
import { useTheme } from '../../hooks/useTheme';
import { toApiError, friendlyMessage } from '../../services/api/errors';

import { fs, ms } from '../../design-system/responsive';
/** Server-recorded replay of a finished game, stepped move by move. */
export const ReplaySheet: React.FC<{ gameId: string | null; onClose: () => void }> = ({ gameId, onClose }) => {
  const c = useTheme();
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

  const board = step === 0 ? Array(replay?.game.boardSize ? replay.game.boardSize ** 2 : 9).fill('') : replay?.frames[step - 1]?.board ?? [];
  const frame = step > 0 ? replay?.frames[step - 1] : null;
  const err = q.error ? toApiError(q.error) : null;
  const size = replay?.game.boardSize ?? 3;
  const g = replay?.game;
  const subtitle = !g
    ? ''
    : g.type === 'AI'
      ? `vs AI ${(g.difficulty ?? 'MEDIUM').charAt(0) + (g.difficulty ?? 'MEDIUM').slice(1).toLowerCase()} • ${size}×${size}`
      : g.type === 'LOCAL'
        ? `Pass & Play • ${size}×${size}`
        : `Online • ${size}×${size}`;

  return (
    <AppModal open={!!gameId} title="Match Replay" onClose={onClose}>
      {q.isLoading ? (
        <AppLoader />
      ) : err ? (
        <ErrorState offline={err.code === 'NETWORK_ERROR'} message={friendlyMessage(err)} onRetry={() => void q.refetch()} />
      ) : replay && total === 0 ? (
        <EmptyState title="No moves saved" description="This match was saved without its moves, so it can't be replayed." />
      ) : replay ? (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text numberOfLines={1} style={{ flex: 1, fontSize: fs(11), marginRight: 8, fontFamily: fonts.body.regular, color: c.textSecondary }}>{subtitle}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {[3, 4, 5].filter((n) => n === size).map((n) => (
                <View key={n} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: c.accentFill }}>
                  <Text style={{ fontSize: fs(10.5), fontFamily: fonts.body.semibold, color: c.onAccent }}>{n}×{n}</Text>
                </View>
              ))}
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: c.bgElevated }}>
                <Text testID="replay-step" style={{ fontSize: fs(10.5), fontFamily: fonts.mono.semibold, color: c.accent }}>{step}/{total}</Text>
              </View>
            </View>
          </View>
          <View style={{ alignItems: 'center' }}>
            <GameBoard
              compact
              disabled
              board={board}
              size={replay.game.boardSize}
              winningLine={step === total ? replay.game.result?.line ?? null : null}
              lastMoveIndex={frame?.position ?? null}
              maxSize={ms(180)}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <AppButton testID="replay-prev" title="← Prev" variant="secondary" size="md" disabled={step === 0} onPress={() => setStep((n) => Math.max(0, n - 1))} style={{ flex: 1 }} />
            <AppButton testID="replay-next" title="Next →" size="md" disabled={step === total} onPress={() => setStep((n) => Math.min(total, n + 1))} style={{ flex: 1 }} />
          </View>
        </View>
      ) : null}
    </AppModal>
  );
};
