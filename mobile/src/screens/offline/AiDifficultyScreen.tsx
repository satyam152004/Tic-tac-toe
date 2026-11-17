import { Bot } from 'lucide-react-native';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppAvatar } from '../../components/common/AppAvatar';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { Screen } from '../../components/common/Screen';
import { SymbolMark } from '../../components/game/SymbolMark';
import { type } from '../../design-system/typography';
import { Difficulty, Mark } from '../../game-engine';
import { useTheme } from '../../hooks/useTheme';
import { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';
import { useLocalGameStore } from '../../store/localGameStore';

/** Descriptions mirror the engine (src/game-engine/ai.ts chooseMove). */
export const AI_LEVELS: { id: Difficulty; name: string; desc: string }[] = [
  { id: 'EASY', name: 'Easy', desc: 'Plays a random legal move. Great for a relaxed warm-up.' },
  { id: 'MEDIUM', name: 'Medium', desc: 'Takes a winning move, blocks yours, otherwise prefers the centre or plays randomly.' },
  { id: 'HARD', name: 'Hard', desc: 'Wins and blocks first, then looks two moves ahead with a board evaluation.' },
  { id: 'EXPERT', name: 'Expert', desc: 'Deep search up to 6 moves ahead within a quarter-second budget. Solves 3x3.' },
  { id: 'IMPOSSIBLE', name: 'Impossible', desc: 'Unbeatable on 3x3 (full search). On 4x4 and 5x5 it searches as deep as time allows.' },
];

export const AiDifficultyScreen: React.FC<RootScreenProps<'ai_difficulty'>> = () => {
  const c = useTheme();
  const { nav } = useAppNav();
  const initial = useLocalGameStore.getState().setup;
  const [difficulty, setDifficulty] = useState<Difficulty>(initial.difficulty);
  const [mark, setMark] = useState<Mark>(initial.p1Mark);

  const next = () => {
    useLocalGameStore.getState().configure({ mode: 'VS_AI', difficulty, p1Mark: mark });
    nav.navigate('board_selection', { mode: 'VS_AI' });
  };

  return (
    <Screen
      title="AI Difficulty"
      onBack={() => nav.goBack()}
      testID="ai-difficulty"
      footer={<AppButton testID="ai-difficulty-continue" fullWidth icon={<Bot size={16} color="#FFFFFF" />} title="Choose Board" onPress={next} />}
    >
      <AppCard>
        <View style={styles.row}>
          <AppAvatar avatarId="av_ai" name="Vortex AI" size="lg" activeRing />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[type.heading, { color: c.text }]}>Vortex AI Strategist</Text>
            <Text style={[type.small, { color: c.textSecondary, marginTop: 2 }]}>Plays offline on 3x3, 4x4 and 5x5 boards</Text>
          </View>
        </View>
      </AppCard>

      <View style={{ gap: 10 }}>
        {AI_LEVELS.map((l) => (
          <AppCard key={l.id} testID={`difficulty-${l.id}`} accessibilityLabel={`${l.name}. ${l.desc}`} selected={difficulty === l.id} onPress={() => setDifficulty(l.id)}>
            <Text style={[type.subheading, { color: c.text }]}>{l.name}</Text>
            <Text style={[type.small, { color: c.textSecondary, marginTop: 4 }]}>{l.desc}</Text>
          </AppCard>
        ))}
      </View>

      <View style={{ gap: 8 }}>
        <Text style={[type.smallStrong, { color: c.textSecondary }]}>You play as (X moves first)</Text>
        <View style={styles.row}>
          {(['X', 'O'] as const).map((m) => (
            <AppCard key={m} testID={`side-${m}`} accessibilityLabel={`Play as ${m}`} selected={mark === m} onPress={() => setMark(m)} padding="sm" style={{ flex: 1, alignItems: 'center' }}>
              <SymbolMark value={m} size="md" animate={false} />
            </AppCard>
          ))}
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
