import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts } from '../../design-system/typography';
import { defaultWinLength } from '../../game-engine';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { ACCENT_SOFT, ProtoButton, ProtoHeader, ProtoScreen, SUBTLE } from '../auth/protoUi';

interface RuleItem {
  key: string;
  testID?: string;
  badge: string;
  title: string;
  desc: string;
  isBlue?: boolean;
}

// Win lengths come from the engine so the copy can never drift from the real rules.
const WIN_3 = defaultWinLength(3);
const WIN_4 = defaultWinLength(4);
const WIN_5 = defaultWinLength(5);

// Values below mirror the server: turn clocks of 15s / 30s / 60s (default 60s), +25 points per ranked win
// (x1.5 on 4x4, x2 on 5x5) - backend/src/constants/index.ts and the room options.
const RULES: RuleItem[] = [
  {
    key: '3',
    testID: 'rule-3',
    badge: '3×3',
    title: `${WIN_3}-in-a-row Classic`,
    desc: `Align ${WIN_3} marks horizontally, vertically, or diagonally.`,
    isBlue: true,
  },
  {
    key: '4',
    testID: 'rule-4',
    badge: '4×4',
    title: `${WIN_4}-in-a-row Extended`,
    desc: `Connect ${WIN_4} marks on 4×4 grids for deeper tactics.`,
  },
  {
    key: '5',
    testID: 'rule-5',
    badge: '5×5',
    title: `${WIN_5}-in-a-row Tactical`,
    desc: `Connect ${WIN_5} marks on 5×5 boards with multi-fork lines.`,
  },
  {
    key: 'timer',
    badge: '60s',
    title: 'Online Turn Timers',
    desc: 'Each turn has a 15s–60s clock; timeout forfeits.',
  },
  {
    key: 'points',
    badge: 'PTS',
    title: 'Ranked Scoring',
    desc: 'Earn +25 points per ranked victory, up to ×2 on bigger boards.',
    isBlue: true,
  },
];

export const GameRulesScreen: React.FC<RootScreenProps<'game_rules'>> = () => {
  const c = useTheme();
  const { back } = useAppNav();

  return (
    <ProtoScreen testID="game-rules-screen">
      <ProtoHeader title="How to Play" onBack={back} />
      <View style={styles.body}>
        <View style={[styles.group, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          {RULES.map((r, i) => (
            <View key={r.key} style={[styles.row, i > 0 ? { borderTopWidth: 1, borderTopColor: c.border } : null]}>
              <View style={[styles.badge, { backgroundColor: r.isBlue ? ACCENT_SOFT : SUBTLE }]}>
                <Text style={[styles.badgeText, { color: r.isBlue ? c.accent : c.text }]}>{r.badge}</Text>
              </View>
              <View style={styles.textCol}>
                <Text style={[styles.ruleTitle, { color: c.text }]}>{r.title}</Text>
                <Text testID={r.testID} style={[styles.ruleDesc, { color: c.textSecondary }]}>
                  {r.desc}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <ProtoButton testID="rules-got-it" title="Got It" onPress={back} />
        </View>
      </View>
    </ProtoScreen>
  );
};

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 16, gap: 12 },
  group: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  row: { minHeight: 36, paddingHorizontal: 13, paddingVertical: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  badge: { width: 28, height: 24, borderRadius: 7, marginTop: 2, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.body.semibold, fontSize: 10 },
  textCol: { flex: 1 },
  ruleTitle: { fontFamily: fonts.body.semibold, fontSize: 12, lineHeight: 16 },
  ruleDesc: { fontFamily: fonts.body.regular, fontSize: 10.5, lineHeight: 14 },
  footer: { marginTop: 'auto', paddingTop: 8 },
});
