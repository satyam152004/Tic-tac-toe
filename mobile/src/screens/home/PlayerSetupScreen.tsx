import React, { useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { AppAvatar } from '../../components/common/AppAvatar';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { SymbolMark } from '../../components/game/SymbolMark';
import { AI_AVATAR_ID, SELECTABLE_AVATARS } from '../../constants/avatars';
import { fonts } from '../../design-system/typography';
import { BoardSize, defaultWinLength } from '../../game-engine';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { useLocalGameStore } from '../../store/localGameStore';

const SIZES: BoardSize[] = [3, 4, 5];
const MAX_NAME = 20;

type FirstMoveOption = 'p1' | 'p2' | 'random';

export function validateNames(p1: string, p2: string | null): { p1?: string; p2?: string } {
  const errors: { p1?: string; p2?: string } = {};
  const a = p1.trim();
  if (a.length < 1) errors.p1 = 'Enter a name for Player 1';
  else if (a.length > MAX_NAME) errors.p1 = `Use ${MAX_NAME} characters or fewer`;
  if (p2 !== null) {
    const b = p2.trim();
    if (b.length < 1) errors.p2 = 'Enter a name for Player 2';
    else if (b.length > MAX_NAME) errors.p2 = `Use ${MAX_NAME} characters or fewer`;
    else if (!errors.p1 && a.toLowerCase() === b.toLowerCase()) errors.p2 = 'Players need different names';
  }
  return errors;
}

export const PlayerSetupScreen: React.FC<RootScreenProps<'player_setup'>> = ({ route }) => {
  const c = useTheme();
  const { nav, back } = useAppNav();
  const mode = route.params?.mode ?? 'LOCAL_2P';
  const isAi = mode === 'VS_AI';
  const stored = useLocalGameStore.getState().setup;
  const displayName = useAuthStore.getState().user?.displayName;

  const [p1Name, setP1Name] = useState(() => (displayName ?? (stored.p1Name || 'Player 1')).slice(0, MAX_NAME));
  const [p2Name, setP2Name] = useState(stored.mode === 'LOCAL_2P' && stored.p2Name ? stored.p2Name : 'Player 2');
  const [p1Avatar, setP1Avatar] = useState(stored.p1Avatar);
  const [p2Avatar, setP2Avatar] = useState(stored.p2Avatar === stored.p1Avatar ? 'av_2' : stored.p2Avatar);
  const [p1Mark, setP1Mark] = useState<'X' | 'O'>(stored.p1Mark);
  const [firstMove, setFirstMove] = useState<FirstMoveOption>('p1');
  const [size, setSize] = useState<BoardSize>(stored.size);
  const [errors, setErrors] = useState<{ p1?: string; p2?: string }>({});

  const { height: screenH } = useWindowDimensions();
  const isTall = screenH >= 780;

  const start = () => {
    const found = validateNames(p1Name, isAi ? null : p2Name);
    setErrors(found);
    if (found.p1 || found.p2) return;
    const store = useLocalGameStore.getState();

    // Determine starting turn based on firstMove selection
    let resolvedP1Mark = p1Mark;
    if (firstMove === 'p2') {
      resolvedP1Mark = p1Mark === 'X' ? 'O' : 'X';
    } else if (firstMove === 'random' && Math.random() < 0.5) {
      resolvedP1Mark = p1Mark === 'X' ? 'O' : 'X';
    }

    store.configure({
      mode,
      size,
      winLength: defaultWinLength(size),
      p1Name: p1Name.trim(),
      p2Name: isAi ? 'Vortex AI' : p2Name.trim(),
      p1Avatar,
      p2Avatar: isAi ? AI_AVATAR_ID : p2Avatar,
      p1Mark: resolvedP1Mark,
      difficulty: store.setup.difficulty,
    });
    store.start();
    nav.navigate('offline_board');
  };

  const p2Mark = p1Mark === 'X' ? 'O' : 'X';

  return (
    <Screen
      title="Player Setup"
      subtitle={isAi ? 'Offline vs AI' : 'Offline 2-Player Match'}
      onBack={back}
      testID="player-setup-screen"
      rightAction={
        <Pressy testID="setup-rules" accessibilityLabel="Game rules" onPress={() => nav.navigate('game_rules')} style={styles.rulesBtn}>
          <Text style={[styles.rulesText, { color: c.accent }]}>Rules</Text>
        </Pressy>
      }
      footer={<AppButton testID="setup-start" title="Start Match" size={isTall ? 'lg' : 'md'} fullWidth onPress={start} />}
    >
      <View style={[styles.container, { gap: isTall ? 16 : 12 }]}>
        {/* Names Card Section */}
        <View style={[styles.cardSection, { gap: isTall ? 12 : 10 }]}>
          <AppInput
            testID="p1-name"
            accessibilityLabel="Player 1 name"
            label="Player 1 Name"
            value={p1Name}
            onChangeText={setP1Name}
            placeholder="Player 1"
            maxLength={MAX_NAME + 10}
            error={errors.p1}
            labelRight={
              <View style={[styles.markTag, { backgroundColor: '#EFF4FF' }]}>
                <Text style={[styles.markTagText, { color: '#1D4ED8' }]}>{p1Mark}</Text>
              </View>
            }
          />

          {!isAi ? (
            <AppInput
              testID="p2-name"
              accessibilityLabel="Player 2 name"
              label="Player 2 Name"
              value={p2Name}
              onChangeText={setP2Name}
              placeholder="Player 2"
              maxLength={MAX_NAME + 10}
              error={errors.p2}
              labelRight={
                <View style={[styles.markTag, { backgroundColor: '#F1F1EE' }]}>
                  <Text style={[styles.markTagText, { color: '#141518' }]}>{p2Mark}</Text>
                </View>
              }
            />
          ) : null}
        </View>

        {/* Symbol Picker Section */}
        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>Symbol Picker</Text>
          <View style={styles.symbolGrid}>
            {/* Play as X */}
            <Pressy
              testID="mark-X"
              accessibilityLabel="Play as X"
              accessibilityState={{ selected: p1Mark === 'X' }}
              onPress={() => setP1Mark('X')}
              style={[
                styles.symbolBtn,
                {
                  height: isTall ? 46 : 42,
                  backgroundColor: p1Mark === 'X' ? '#1D4ED8' : c.bgCard,
                  borderColor: p1Mark === 'X' ? '#1D4ED8' : c.border,
                },
              ]}
            >
              <SymbolMark value="X" size={16} animate={false} />
              <Text style={[styles.symbolBtnText, { color: p1Mark === 'X' ? '#FFFFFF' : c.text }]}>
                Play as X
              </Text>
            </Pressy>

            {/* Play as O */}
            <Pressy
              testID="mark-O"
              accessibilityLabel="Play as O"
              accessibilityState={{ selected: p1Mark === 'O' }}
              onPress={() => setP1Mark('O')}
              style={[
                styles.symbolBtn,
                {
                  height: isTall ? 46 : 42,
                  backgroundColor: p1Mark === 'O' ? '#141518' : c.bgCard,
                  borderColor: p1Mark === 'O' ? '#141518' : c.border,
                },
              ]}
            >
              <SymbolMark value="O" size={16} animate={false} />
              <Text style={[styles.symbolBtnText, { color: p1Mark === 'O' ? '#FFFFFF' : c.text }]}>
                Play as O
              </Text>
            </Pressy>
          </View>
        </View>

        {/* First Move Segment */}
        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>First Move</Text>
          <View style={[styles.segmentTrack, { backgroundColor: '#F1F1EE', borderColor: c.border }]}>
            {(['p1', 'p2', 'random'] as const).map((opt) => {
              const active = firstMove === opt;
              const label = opt === 'p1' ? 'Player 1' : opt === 'p2' ? (isAi ? 'AI Bot' : 'Player 2') : 'Random';
              return (
                <Pressy
                  key={opt}
                  accessibilityLabel={`First move ${label}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => setFirstMove(opt)}
                  style={[
                    styles.segmentThumb,
                    {
                      height: isTall ? 34 : 30,
                      backgroundColor: active ? '#FFFFFF' : 'transparent',
                      shadowOpacity: active ? 0.05 : 0,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: active ? '#1D4ED8' : '#5C606A', fontFamily: active ? fonts.body.semibold : fonts.body.medium },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressy>
              );
            })}
          </View>
        </View>

        {/* Board Size Grid */}
        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>Board Size</Text>
          <View style={styles.sizesRow}>
            {SIZES.map((sz) => {
              const active = size === sz;
              return (
                <Pressy
                  key={sz}
                  testID={`size-${sz}`}
                  accessibilityLabel={`${sz} by ${sz} board`}
                  accessibilityState={{ selected: active }}
                  onPress={() => setSize(sz)}
                  style={[
                    styles.sizeCard,
                    {
                      height: isTall ? 58 : 52,
                      backgroundColor: active ? '#EFF4FF' : c.bgCard,
                      borderColor: active ? '#1D4ED8' : c.border,
                      borderWidth: active ? 1.5 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.sizeNum, { color: active ? '#1D4ED8' : c.text }]}>{sz}×{sz}</Text>
                  <Text style={[styles.sizeSub, { color: active ? '#1D4ED8' : c.textSecondary }]}>
                    {defaultWinLength(sz)} in a row
                  </Text>
                </Pressy>
              );
            })}
          </View>
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 4,
  },
  cardSection: {},
  rulesBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rulesText: {
    fontFamily: fonts.body.semibold,
    fontSize: 13,
  },
  markTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  markTagText: {
    fontSize: 11,
    fontFamily: fonts.mono.semibold,
  },
  sectionBlock: {
    gap: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: fonts.body.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  symbolGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  symbolBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.02,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  symbolBtnText: {
    fontSize: 12.5,
    fontFamily: fonts.body.semibold,
  },
  segmentTrack: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
  },
  segmentThumb: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontSize: 12,
  },
  sizesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sizeCard: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  sizeNum: {
    fontSize: 13.5,
    fontFamily: fonts.body.semibold,
  },
  sizeSub: {
    fontSize: 10,
    fontFamily: fonts.body.regular,
  },
});
