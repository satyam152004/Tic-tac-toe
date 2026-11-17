import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppAvatar } from '../../components/common/AppAvatar';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppInput } from '../../components/common/AppInput';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { SymbolMark } from '../../components/game/SymbolMark';
import { AI_AVATAR_ID, SELECTABLE_AVATARS } from '../../constants/avatars';
import { fonts, type } from '../../design-system/typography';
import { BoardSize, defaultWinLength } from '../../game-engine';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { useLocalGameStore } from '../../store/localGameStore';

const SIZES: BoardSize[] = [3, 4, 5];
const MAX_NAME = 20;

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

const AvatarRow: React.FC<{ value: string; onChange: (id: string) => void; label: string }> = ({ value, onChange, label }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
    {SELECTABLE_AVATARS.map((av) => (
      <Pressy key={av.id} testID={`${label}-avatar-${av.id}`} accessibilityLabel={`${label} avatar ${av.label}`} accessibilityState={{ selected: value === av.id }} onPress={() => onChange(av.id)} style={styles.avatarBtn}>
        <AppAvatar avatarId={av.id} size="sm" activeRing={value === av.id} />
      </Pressy>
    ))}
  </ScrollView>
);

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
  const [size, setSize] = useState<BoardSize>(stored.size);
  const [errors, setErrors] = useState<{ p1?: string; p2?: string }>({});

  const start = () => {
    const found = validateNames(p1Name, isAi ? null : p2Name);
    setErrors(found);
    if (found.p1 || found.p2) return;
    const store = useLocalGameStore.getState();
    store.configure({
      mode,
      size,
      winLength: defaultWinLength(size),
      p1Name: p1Name.trim(),
      p2Name: isAi ? 'Vortex AI' : p2Name.trim(),
      p1Avatar,
      p2Avatar: isAi ? AI_AVATAR_ID : p2Avatar,
      p1Mark,
      difficulty: store.setup.difficulty,
    });
    store.start();
    nav.navigate('offline_board');
  };

  return (
    <Screen
      title="Player Setup"
      subtitle={isAi ? 'Offline vs AI' : 'Offline 2-Player Match'}
      onBack={back}
      testID="player-setup-screen"
      rightAction={
        <Pressy testID="setup-rules" accessibilityLabel="Game rules" onPress={() => nav.navigate('game_rules')} style={styles.rules}>
          <Text style={[type.smallStrong, { color: c.accent }]}>Rules</Text>
        </Pressy>
      }
      footer={<AppButton testID="setup-start" title="Start Game" fullWidth onPress={start} />}
    >
      <AppCard style={{ gap: 12 }}>
        <View style={styles.between}>
          <Text style={[type.smallStrong, { color: c.textSecondary }]}>Player 1</Text>
          <View style={styles.marks}>
            {(['X', 'O'] as const).map((m) => (
              <Pressy
                key={m}
                testID={`mark-${m}`}
                accessibilityLabel={`Play as ${m}`}
                accessibilityState={{ selected: p1Mark === m }}
                onPress={() => setP1Mark(m)}
                style={[styles.mark, { borderColor: p1Mark === m ? c.accent : c.border, backgroundColor: p1Mark === m ? c.accent + '33' : c.bgSecondary, opacity: p1Mark === m ? 1 : 0.6 }]}
              >
                <SymbolMark value={m} size="sm" glow={p1Mark === m} animate={false} />
              </Pressy>
            ))}
          </View>
        </View>
        <AppInput testID="p1-name" accessibilityLabel="Player 1 name" value={p1Name} onChangeText={setP1Name} placeholder="Player 1 name" maxLength={MAX_NAME + 10} error={errors.p1} />
        <AvatarRow label="p1" value={p1Avatar} onChange={setP1Avatar} />
      </AppCard>

      {isAi ? null : (
        <AppCard style={{ gap: 12 }}>
          <View style={styles.between}>
            <Text style={[type.smallStrong, { color: c.textSecondary }]}>Player 2</Text>
            <View style={styles.marks}>
              <Text style={[type.small, { color: c.textSecondary }]}>Assigned:</Text>
              <SymbolMark value={p1Mark === 'X' ? 'O' : 'X'} size="sm" animate={false} />
            </View>
          </View>
          <AppInput testID="p2-name" accessibilityLabel="Player 2 name" value={p2Name} onChangeText={setP2Name} placeholder="Player 2 name" maxLength={MAX_NAME + 10} error={errors.p2} />
          <AvatarRow label="p2" value={p2Avatar} onChange={setP2Avatar} />
        </AppCard>
      )}

      <View style={{ gap: 8 }}>
        <Text style={[type.smallStrong, { color: c.textSecondary }]}>Board Size</Text>
        <View style={styles.sizes}>
          {SIZES.map((sz) => (
            <View key={sz} style={{ flex: 1 }}>
              <AppCard selected={size === sz} onPress={() => setSize(sz)} padding="sm" testID={`size-${sz}`} accessibilityLabel={`${sz} by ${sz} board`} style={{ alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.mono.bold, fontSize: 16, color: c.text }}>{sz}x{sz}</Text>
                <Text style={[type.caption, { color: c.textSecondary }]}>{defaultWinLength(sz)} in a row</Text>
              </AppCard>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  marks: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mark: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarBtn: { padding: 2, borderRadius: 16 },
  rules: { minHeight: 44, minWidth: 44, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  sizes: { flexDirection: 'row', gap: 10 },
});
