import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { AppButton } from '../../components/common/AppButton';
import { Screen } from '../../components/common/Screen';
import { fonts } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';

interface RuleItem {
  key: string;
  testID?: string;
  badge: string;
  title: string;
  desc: string;
  isBlue?: boolean;
}

const RULES: RuleItem[] = [
  {
    key: '3',
    testID: 'rule-3',
    badge: '3×3',
    title: '3-in-a-row Classic',
    desc: 'Align 3 marks horizontally, vertically, or diagonally (align 3 in a row) to win.',
    isBlue: true,
  },
  {
    key: '4',
    testID: 'rule-4',
    badge: '4×4',
    title: '4-in-a-row Extended',
    desc: 'Connect 4 marks (align 4 in a row) on 4×4 grids for deeper tactics.',
    isBlue: false,
  },
  {
    key: '5',
    testID: 'rule-5',
    badge: '5×5',
    title: '4-in-a-row Tactical',
    desc: 'Connect 4 marks (align 4 in a row) on 5×5 tactical boards with multi-fork lines.',
    isBlue: false,
  },
  {
    key: '30s',
    badge: '30s',
    title: 'Online Turn Timers',
    desc: 'Each turn has a 15s–30s clock; timeout forfeits the match.',
    isBlue: false,
  },
  {
    key: 'elo',
    badge: 'ELO',
    title: 'Ranked ELO Scoring',
    desc: 'Earn +12 to +24 ELO per ranked victory to advance through divisions.',
    isBlue: true,
  },
];

export const GameRulesScreen: React.FC<RootScreenProps<'game_rules'>> = () => {
  const c = useTheme();
  const { back } = useAppNav();
  const { height: screenH } = useWindowDimensions();
  const isTall = screenH >= 780;

  return (
    <Screen
      title="How to Play"
      onBack={back}
      testID="game-rules-screen"
      footer={<AppButton title="Got It" size={isTall ? 'lg' : 'md'} fullWidth onPress={back} />}
    >
      <View style={[styles.groupCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
        {RULES.map((r, index) => {
          const isLast = index === RULES.length - 1;
          return (
            <React.Fragment key={r.key}>
              <View style={[styles.ruleRow, { paddingVertical: isTall ? 14 : 11 }]}>
                <View
                  style={[
                    styles.badgeSquircle,
                    {
                      backgroundColor: r.isBlue ? '#EFF4FF' : '#F1F1EE',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      { color: r.isBlue ? '#1D4ED8' : '#141518' },
                    ]}
                  >
                    {r.badge}
                  </Text>
                </View>

                <View style={styles.textCol}>
                  <Text style={[styles.ruleTitle, { color: c.text, fontSize: isTall ? 13.5 : 12.5 }]}>
                    {r.title}
                  </Text>
                  <Text
                    testID={r.testID}
                    style={[styles.ruleDesc, { color: c.textSecondary, fontSize: isTall ? 11.5 : 10.5 }]}
                  >
                    {r.desc}
                  </Text>
                </View>
              </View>

              {!isLast ? (
                <View style={[styles.divider, { backgroundColor: c.border }]} />
              ) : null}
            </React.Fragment>
          );
        })}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  groupCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.02,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    gap: 12,
  },
  badgeSquircle: {
    width: 32,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: fonts.mono.semibold,
  },
  textCol: {
    flex: 1,
    gap: 3,
  },
  ruleTitle: {
    fontFamily: fonts.body.semibold,
  },
  ruleDesc: {
    fontFamily: fonts.body.regular,
    lineHeight: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 58,
  },
});
