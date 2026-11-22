import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { BoardCell, GameBoard } from '../../components/game/GameBoard';
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
  const { friendName } = route.params;
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

  const cheer = (key: 'clap' | 'fire' | 'wow', label: string) => {
    setCheers((prev) => ({ ...prev, [key]: prev[key] + 1 }));
    toast.info('Reaction sent', `Cheered ${label} in live room`);
  };

  return (
    <Screen
      title="Live Spectate"
      onBack={back}
      testID="spectate-match-screen"
      scroll={false}
      padded={false}
      rightAction={
        <View style={styles.liveBadge}>
          <Text style={styles.liveBadgeText}>LIVE • 18</Text>
        </View>
      }
      footer={
        <View style={styles.footer}>
          <AppButton
            testID="spectate-leave"
            title="Leave Spectate"
            variant="secondary"
            fullWidth
            onPress={back}
          />
        </View>
      }
    >
      <View style={styles.content}>
        {/* Progress Bar */}
        <View style={[styles.track, { backgroundColor: c.bgSecondary }]}>
          <View style={[styles.fill, { width: '63%', backgroundColor: c.accent }]} />
        </View>

        {/* Live Player Bar */}
        <View style={[styles.playerCard, { backgroundColor: c.bgCard, borderColor: c.accent }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={[styles.avatar, { backgroundColor: c.accent }]}>
              <Text style={styles.avatarText}>MR</Text>
            </View>
            <View>
              <Text style={[styles.name, { color: c.text }]}>
                {friendName ?? 'Meera Rao'} (X) • Thinking
              </Text>
              <Text style={[styles.sub, { color: c.textSecondary }]}>
                1,790 ELO • Move 6 of 9
              </Text>
            </View>
          </View>
          <Text style={styles.timer}>00:{String(seconds).padStart(2, '0')}</Text>
        </View>

        {/* Board */}
        <View style={styles.boardWrap}>
          <GameBoard board={board} size={3} disabled maxSize={260} />
        </View>

        {/* Cheers Row */}
        <View style={styles.cheersRow}>
          <Pressy
            testID="cheer-clap"
            accessibilityLabel="Send applause"
            onPress={() => cheer('clap', 'Applause')}
            style={[styles.cheerBtn, { backgroundColor: c.bgCard, borderColor: c.border }]}
          >
            <Text style={[styles.cheerText, { color: c.text }]}>👏 {cheers.clap}</Text>
          </Pressy>

          <Pressy
            testID="cheer-fire"
            accessibilityLabel="Send fire"
            onPress={() => cheer('fire', 'Fire')}
            style={[styles.cheerBtn, { backgroundColor: c.bgCard, borderColor: c.border }]}
          >
            <Text style={[styles.cheerText, { color: c.text }]}>🔥 {cheers.fire}</Text>
          </Pressy>

          <Pressy
            testID="cheer-wow"
            accessibilityLabel="Send wow"
            onPress={() => cheer('wow', 'Wow')}
            style={[styles.cheerBtn, { backgroundColor: '#EFF4FF', borderColor: c.accent }]}
          >
            <Text style={[styles.cheerText, { color: c.accent }]}>😮 {cheers.wow}</Text>
          </Pressy>
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  liveBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  liveBadgeText: {
    fontSize: 10,
    fontFamily: fonts.mono.semibold,
    color: '#B91C1C',
  },
  track: {
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 10,
    fontFamily: fonts.mono.semibold,
    color: '#FFFFFF',
  },
  name: {
    fontSize: 12,
    fontFamily: fonts.body.semibold,
  },
  sub: {
    fontSize: 10,
    fontFamily: fonts.mono.medium,
    marginTop: 1,
  },
  timer: {
    fontSize: 12,
    fontFamily: fonts.mono.semibold,
    color: '#1D4ED8',
  },
  boardWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cheersRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cheerBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cheerText: {
    fontSize: 11.5,
    fontFamily: fonts.mono.semibold,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 16,
  },
});
