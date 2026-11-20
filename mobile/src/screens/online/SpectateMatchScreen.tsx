import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Eye, Radio } from 'lucide-react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { BoardCell, GameBoard } from '../../components/game/GameBoard';
import { PlayerCard } from '../../components/game/PlayerCard';
import { withAlpha } from '../../design-system/colors';
import { fonts, type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import type { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';
import { toast } from '../../store/toastStore';

const SPECTATE_FRAMES: BoardCell[][] = [
  ['X', '', '', '', 'O', '', '', '', ''],
  ['X', 'O', '', '', 'O', '', 'X', '', ''],
  ['X', 'O', '', 'O', 'X', '', 'X', '', ''],
  ['X', 'O', 'O', 'O', 'X', '', 'X', '', ''],
];

export const SpectateMatchScreen: React.FC<RootScreenProps<'spectate_match'>> = ({ route }) => {
  const { friendName, friendAvatar } = route.params;
  const c = useTheme();
  const { back } = useAppNav();
  const [frameIdx, setFrameIdx] = useState(2);
  const [seconds, setSeconds] = useState(19);
  const [cheers, setCheers] = useState({ clap: 12, fire: 8, wow: 4 });

  useEffect(() => {
    const id = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          setFrameIdx((f) => (f + 1) % SPECTATE_FRAMES.length);
          return 24;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const board = SPECTATE_FRAMES[frameIdx] ?? SPECTATE_FRAMES[0]!;
  const xTurn = frameIdx % 2 === 0;

  const cheer = (key: 'clap' | 'fire' | 'wow', label: string) => {
    setCheers((prev) => ({ ...prev, [key]: prev[key] + 1 }));
    toast.info('Reaction sent', `Cheered ${label} in live room`);
  };

  return (
    <Screen
      title="Live Spectate"
      subtitle="Read-only friend broadcast"
      onBack={back}
      testID="spectate-match-screen"
      rightAction={
        <View style={[styles.livePill, { backgroundColor: c.dangerSoft, borderColor: c.dangerBorder }]}>
          <Radio size={12} color={c.dangerText} />
          <Text style={[type.caption, { color: c.dangerText, fontFamily: fonts.mono.medium }]}>LIVE</Text>
        </View>
      }
      footer={<AppButton testID="spectate-leave" title="Leave Spectate" variant="secondary" fullWidth onPress={back} />}
    >
      <View style={styles.cards}>
        <PlayerCard
          name={friendName}
          avatarId={friendAvatar}
          symbol="X"
          score={board.filter((x) => x === 'X').length}
          isActive={xTurn}
          activeLabel="Thinking"
          subtitle="Friend"
        />
        <PlayerCard
          name="Arena Rival"
          avatarId="av_3"
          symbol="O"
          score={board.filter((x) => x === 'O').length}
          isActive={!xTurn}
          activeLabel="Thinking"
          subtitle="Opponent"
        />
      </View>

      <AppCard padding="sm" style={styles.statusRow}>
        <View style={styles.row}>
          <Eye size={15} color={c.accent} />
          <Text style={[type.smallStrong, { color: c.text }]}>
            {xTurn ? `${friendName}'s turn` : "Arena Rival's turn"}
          </Text>
        </View>
        <Text style={[type.num, { color: c.accent }]}>00:{String(seconds).padStart(2, '0')}</Text>
      </AppCard>

      <View style={{ paddingVertical: 6 }}>
        <GameBoard board={board} size={3} disabled maxSize={320} />
      </View>

      <View style={styles.cheers}>
        <Pressy
          testID="cheer-clap"
          accessibilityLabel="Send applause"
          onPress={() => cheer('clap', 'Applause')}
          style={[styles.cheerBtn, { backgroundColor: c.bgCard, borderColor: c.border }]}
        >
          <Text style={[type.smallStrong, { color: c.text, fontFamily: fonts.mono.medium }]}>👏 {cheers.clap}</Text>
        </Pressy>
        <Pressy
          testID="cheer-fire"
          accessibilityLabel="Send fire"
          onPress={() => cheer('fire', 'Fire')}
          style={[styles.cheerBtn, { backgroundColor: c.bgCard, borderColor: c.border }]}
        >
          <Text style={[type.smallStrong, { color: c.text, fontFamily: fonts.mono.medium }]}>🔥 {cheers.fire}</Text>
        </Pressy>
        <Pressy
          testID="cheer-wow"
          accessibilityLabel="Send wow"
          onPress={() => cheer('wow', 'Wow')}
          style={[styles.cheerBtn, { backgroundColor: withAlpha(c.accent, 0.08), borderColor: c.accent }]}
        >
          <Text style={[type.smallStrong, { color: c.accent, fontFamily: fonts.mono.medium }]}>😮 {cheers.wow}</Text>
        </Pressy>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  cards: { flexDirection: 'row', gap: 10 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cheers: { flexDirection: 'row', gap: 10 },
  cheerBtn: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
