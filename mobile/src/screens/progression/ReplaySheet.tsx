import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react-native';
import { AppModal } from '../../components/common/AppModal';
import { Pressy } from '../../components/common/Pressy';
import { GameBoard } from '../../components/game/GameBoard';
import { EmptyState, ErrorState } from '../../components/feedback/StateViews';
import { AppLoader } from '../../components/feedback/AppLoader';
import { type } from '../../design-system/typography';
import { useReplay } from '../../hooks/queries';
import { useTheme } from '../../hooks/useTheme';
import { toApiError, friendlyMessage } from '../../services/api/errors';

const Step: React.FC<{ label: string; disabled: boolean; onPress: () => void; children: React.ReactNode; testID: string }> = ({ label, disabled, onPress, children, testID }) => {
  const c = useTheme();
  return (
    <Pressy
      testID={testID}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={{ width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bgElevated, borderWidth: 1, borderColor: c.border, opacity: disabled ? 0.4 : 1 }}
    >
      {children}
    </Pressy>
  );
};

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

  return (
    <AppModal open={!!gameId} title="Match Replay" onClose={onClose}>
      {q.isLoading ? (
        <AppLoader />
      ) : err ? (
        <ErrorState offline={err.code === 'NETWORK_ERROR'} message={friendlyMessage(err)} onRetry={() => void q.refetch()} />
      ) : replay && total === 0 ? (
        <EmptyState title="No moves recorded" description="This game has no recorded moves." />
      ) : replay ? (
        <View style={{ gap: 12 }}>
          <GameBoard
            compact
            disabled
            board={board}
            size={replay.game.boardSize}
            winningLine={step === total ? replay.game.result?.line ?? null : null}
            lastMoveIndex={frame?.position ?? null}
            maxSize={300}
          />
          <Text testID="replay-step" style={[type.smallStrong, { color: c.textSecondary, textAlign: 'center' }]}>
            {step === 0 ? 'Start' : `Move ${step} of ${total}${frame ? ` · ${frame.mark} at ${frame.position + 1}` : ''}`}
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
            <Step testID="replay-first" label="First move" disabled={step === 0} onPress={() => setStep(0)}><ChevronsLeft size={20} color={c.text} /></Step>
            <Step testID="replay-prev" label="Previous move" disabled={step === 0} onPress={() => setStep((s) => Math.max(0, s - 1))}><ChevronLeft size={20} color={c.text} /></Step>
            <Step testID="replay-next" label="Next move" disabled={step === total} onPress={() => setStep((s) => Math.min(total, s + 1))}><ChevronRight size={20} color={c.text} /></Step>
            <Step testID="replay-last" label="Last move" disabled={step === total} onPress={() => setStep(total)}><ChevronsRight size={20} color={c.text} /></Step>
          </View>
        </View>
      ) : null}
    </AppModal>
  );
};
