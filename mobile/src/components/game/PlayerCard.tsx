import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts, type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { AppAvatar } from '../common/AppAvatar';
import { SymbolMark } from './SymbolMark';

import { ch, fs, ms } from '../../design-system/responsive';
export const PlayerCard: React.FC<{
  name: string;
  avatarId?: string | null;
  symbol: 'X' | 'O';
  score: number;
  isActive: boolean;
  activeLabel?: string;
  subtitle?: string;
  /** Tighter padding for short screens. */
  dense?: boolean;
}> = ({ name, avatarId, symbol, score, isActive, activeLabel = 'Your Turn', subtitle, dense }) => {
  const c = useTheme();
  return (
    <View
      accessibilityLabel={`${name}, ${symbol}, score ${score}${isActive ? ', active turn' : ''}`}
      style={[
        styles.card,
        dense && styles.dense,
        isActive
          ? { backgroundColor: c.bgElevated, borderColor: c.accent, shadowColor: c.accent, shadowOpacity: 0.22, shadowRadius: 14, elevation: 3 }
          : { backgroundColor: c.bgCard, borderColor: c.border, opacity: 0.8 },
      ]}
    >
      <AppAvatar avatarId={avatarId} name={name} size="sm" activeRing={isActive} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.row}>
          <Text numberOfLines={1} style={[type.bodyStrong, { color: c.text, fontSize: fs(14), flex: 1 }]}>{name}</Text>
          <SymbolMark value={symbol} size={ms(18)} glow={isActive} animate={false} />
        </View>
        <View style={styles.row}>
          <Text numberOfLines={1} style={[type.caption, { color: c.textSecondary, flex: 1 }]}>{isActive ? activeLabel : subtitle ?? 'Waiting'}</Text>
          <Text style={[type.num, { color: c.text }]}>{score}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  dense: { padding: ms(8), gap: ms(8) },
  card: { flex: 1, minWidth: 0, borderRadius: 16, borderWidth: 1, padding: ms(10), flexDirection: 'row', alignItems: 'center', gap: ms(10) },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
});

/** Compact scoreboard chip used on the board screens: mark + "Name (X)" on the left, running score on the right. */
export const ScoreChip: React.FC<{
  name: string;
  symbol: 'X' | 'O';
  score: number;
  isActive: boolean;
  testID?: string;
}> = ({ name, symbol, score, isActive, testID }) => {
  const c = useTheme();
  return (
    <View
      testID={testID}
      accessibilityLabel={`${name}, ${symbol}, score ${score}${isActive ? ', active turn' : ''}`}
      style={[
        chip.card,
        isActive ? { borderColor: c.accent, backgroundColor: c.bgElevated } : { borderColor: c.border, backgroundColor: c.bgCard },
      ]}
    >
      <View style={chip.left}>
        <SymbolMark value={symbol} size={ms(16)} animate={false} />
        <Text numberOfLines={1} style={[chip.name, { color: c.text }]}>{name} ({symbol})</Text>
      </View>
      <Text style={[chip.score, { color: c.text }]}>{score}</Text>
    </View>
  );
};

const chip = StyleSheet.create({
  card: { flex: 1, minWidth: 0, borderRadius: 12, borderWidth: 1, paddingHorizontal: ms(10), paddingVertical: ms(8), minHeight: ch(40), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: ms(6) },
  left: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: ms(6) },
  name: { flexShrink: 1, fontFamily: fonts.body.semibold, fontSize: fs(12) },
  score: { fontFamily: fonts.mono.semibold, fontSize: fs(16) },
});
