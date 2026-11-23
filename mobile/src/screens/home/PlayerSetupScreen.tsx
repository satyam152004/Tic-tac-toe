import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressy } from '../../components/common/Pressy';
import { AI_AVATAR_ID } from '../../constants/avatars';
import { fonts } from '../../design-system/typography';
import { defaultWinLength } from '../../game-engine';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { useLocalGameStore } from '../../store/localGameStore';
import { MUTED, ProtoButton, ProtoHeader, ProtoInput, ProtoScreen, SUBTLE } from '../auth/protoUi';

import { fs, ms, ch } from '../../design-system/responsive';
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
  const [errors, setErrors] = useState<{ p1?: string; p2?: string }>({});


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
      size: stored.size,
      winLength: defaultWinLength(stored.size),
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
  const markColor = (m: 'X' | 'O') => (m === 'X' ? c.accent : '#141518');

  return (
    <ProtoScreen testID="player-setup-screen">
      <ProtoHeader title="Player Setup" onBack={back} />
      <View style={styles.body}>
        <View style={styles.names}>
          <ProtoInput
            testID="p1-name"
            label="Player 1 Name"
            value={p1Name}
            onChangeText={setP1Name}
            placeholder="Player 1"
            maxLength={MAX_NAME + 10}
            error={errors.p1}
            right={<Text style={[styles.tag, { color: markColor(p1Mark) }]}>{p1Mark}</Text>}
          />
          {!isAi ? (
            <ProtoInput
              testID="p2-name"
              label="Player 2 Name"
              value={p2Name}
              onChangeText={setP2Name}
              placeholder="Player 2"
              maxLength={MAX_NAME + 10}
              error={errors.p2}
              right={<Text style={[styles.tag, { color: markColor(p2Mark) }]}>{p2Mark}</Text>}
            />
          ) : null}
        </View>

        <View>
          <Text style={[styles.sectionLabel, { color: MUTED }]}>PICK A SYMBOL</Text>
          <View style={styles.symbolGrid}>
            {(['X', 'O'] as const).map((m) => {
              const active = p1Mark === m;
              return (
                <Pressy
                  key={m}
                  testID={`mark-${m}`}
                  accessibilityLabel={`Play as ${m}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => setP1Mark(m)}
                  hitSlop={{ top: 4, bottom: 4 }}
                  style={[styles.symbolBtn, { backgroundColor: m === 'X' ? c.accentFill : '#141518', opacity: active ? 1 : 0.5 }]}
                >
                  <Text style={styles.symbolText}>Play as {m}</Text>
                </Pressy>
              );
            })}
          </View>
        </View>

        <View>
          <Text style={[styles.sectionLabel, { color: MUTED }]}>WHO GOES FIRST</Text>
          <View style={[styles.segmentTrack, { backgroundColor: SUBTLE, borderColor: c.border }]}>
            {(['p1', 'p2', 'random'] as const).map((opt) => {
              const active = firstMove === opt;
              const label = opt === 'p1' ? 'Player 1' : opt === 'p2' ? (isAi ? 'AI Bot' : 'Player 2') : 'Random';
              return (
                <Pressy
                  key={opt}
                  accessibilityLabel={`${label} goes first`}
                  accessibilityState={{ selected: active }}
                  onPress={() => setFirstMove(opt)}
                  hitSlop={{ top: 4, bottom: 4 }}
                  scaleTo={1}
                  style={[styles.segment, active ? { backgroundColor: c.bgCard, shadowOpacity: 0.05 } : null]}
                >
                  <Text style={[styles.segmentText, active ? { color: c.accent, fontFamily: fonts.body.semibold } : { color: c.textSecondary, fontFamily: fonts.body.medium }]}>
                    {label}
                  </Text>
                </Pressy>
              );
            })}
          </View>
        </View>

        <View style={styles.footer}>
          <ProtoButton testID="setup-start" title="Start Match" onPress={start} />
        </View>
      </View>
    </ProtoScreen>
  );
};

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 14 },
  names: { gap: 10 },
  tag: { fontFamily: fonts.body.semibold, fontSize: fs(12) },
  sectionLabel: { fontFamily: fonts.body.semibold, fontSize: fs(11), lineHeight: Math.round(fs(11) * 1.3), letterSpacing: 0.5, marginBottom: 6, paddingLeft: 2 },
  symbolGrid: { flexDirection: 'row', gap: 8 },
  symbolBtn: { flex: 1, minHeight: ch(40), paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  symbolText: { fontFamily: fonts.body.semibold, fontSize: fs(13), lineHeight: Math.round(fs(13) * 1.3), color: '#FFFFFF' },
  segmentTrack: { flexDirection: 'row', gap: 6, padding: 4, borderRadius: 10, borderWidth: 1 },
  segment: {
    flex: 1,
    minHeight: ch(34),
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#141518',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0,
    shadowRadius: 2,
  },
  segmentText: { fontSize: fs(13), lineHeight: Math.round(fs(13) * 1.3) },
  footer: { marginTop: 'auto', paddingTop: 8 },
});
