import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { AppAvatar } from '../common/AppAvatar';
import { SymbolMark } from './SymbolMark';

export const PlayerCard: React.FC<{
  name: string;
  avatarId?: string | null;
  symbol: 'X' | 'O';
  score: number;
  isActive: boolean;
  activeLabel?: string;
  subtitle?: string;
}> = ({ name, avatarId, symbol, score, isActive, activeLabel = 'Your Turn', subtitle }) => {
  const c = useTheme();
  return (
    <View
      accessibilityLabel={`${name}, ${symbol}, score ${score}${isActive ? ', active turn' : ''}`}
      style={[
        styles.card,
        isActive
          ? { backgroundColor: c.bgElevated, borderColor: c.accent, shadowColor: c.accent, shadowOpacity: 0.22, shadowRadius: 14, elevation: 3 }
          : { backgroundColor: c.bgCard, borderColor: c.border, opacity: 0.8 },
      ]}
    >
      <AppAvatar avatarId={avatarId} name={name} size="sm" activeRing={isActive} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.row}>
          <Text numberOfLines={1} style={[type.bodyStrong, { color: c.text, fontSize: 13, flex: 1 }]}>{name}</Text>
          <SymbolMark value={symbol} size="sm" glow={isActive} animate={false} />
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
  card: { flex: 1, minWidth: 0, borderRadius: 16, borderWidth: 1, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
});
