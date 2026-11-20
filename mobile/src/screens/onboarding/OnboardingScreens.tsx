import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { AppAvatar } from '../../components/common/AppAvatar';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { GameBoard } from '../../components/game/GameBoard';
import { withAlpha } from '../../design-system/colors';
import { fonts, type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { useSettingsStore } from '../../store/settingsStore';

type Step = 1 | 2 | 3;
const STEP_ROUTES = { 1: 'onboarding_1', 2: 'onboarding_2', 3: 'onboarding_3' } as const;

const CONTENT = {
  1: { title: 'Pure Classic Strategy', desc: 'Master classic 3×3 or expand into 4×4 and 5×5 tactical grids with crisp turn feedback.', cta: 'Next' },
  2: { title: 'Calibrated AI Levels', desc: 'Warm up on Easy or test your calculation against our unbeatable Minimax engine.', cta: 'Next' },
  3: { title: 'Instant 1v1 & Rooms', desc: 'Climb the ranked leaderboard or share a private room code with friends.', cta: 'Get Started' },
} as const;

export const OnboardingPage: React.FC<{ step: Step }> = ({ step }) => {
  const c = useTheme();
  const { nav } = useAppNav();
  const content = CONTENT[step];

  const finish = () => {
    useSettingsStore.getState().set({ onboardingSeen: true });
    nav.navigate('welcome');
  };
  const next = () => (step === 3 ? finish() : nav.navigate(STEP_ROUTES[(step + 1) as Step]));

  return (
    <Screen scroll={false} testID={`onboarding-${step}`} contentStyle={{ justifyContent: 'space-between' }}>
      <View style={styles.top}>
        <Text style={[type.smallStrong, { color: c.textSecondary, fontFamily: fonts.mono.medium }]}>{step} / 3</Text>
        <Pressy testID="onboarding-skip" accessibilityLabel="Skip" onPress={finish} style={styles.skip}>
          <Text style={[type.bodyStrong, { color: c.textSecondary }]}>Skip</Text>
        </Pressy>
      </View>

      <View style={{ gap: 24, alignItems: 'center' }}>
        {step === 1 ? (
          <View style={{ width: 220 }}>
            <GameBoard
              compact
              disabled
              size={3}
              board={['X', 'O', '', 'O', 'X', '', '', '', 'X']}
              winningLine={[0, 4, 8]}
              maxSize={220}
            />
          </View>
        ) : step === 2 ? (
          <AppCard style={{ width: '100%', maxWidth: 280, gap: 10 }}>
            <View style={[styles.botRow, { borderBottomColor: c.border }]}>
              <Text style={[type.small, { color: c.textSecondary }]}>Casual Bot</Text>
              <Text style={[type.caption, { color: c.textSecondary }]}>Level 1</Text>
            </View>
            <View style={[styles.botRow, { borderBottomColor: c.border }]}>
              <Text style={[type.small, { color: c.textSecondary }]}>Tactical Bot</Text>
              <Text style={[type.caption, { color: c.textSecondary }]}>Level 2</Text>
            </View>
            <View style={[styles.botHighlight, { backgroundColor: withAlpha(c.accent, 0.1) }]}>
              <Text style={[type.smallStrong, { color: c.accent }]}>Unbeatable Minimax</Text>
              <Check size={16} color={c.accent} />
            </View>
          </AppCard>
        ) : (
          <AppCard style={{ width: '100%', maxWidth: 280, gap: 14 }}>
            <View style={styles.between}>
              <Text style={[type.caption, { color: c.accent }]}>1V1 RANKED ARENA</Text>
              <View style={[styles.eloBadge, { backgroundColor: withAlpha(c.success, 0.14) }]}>
                <Text style={[type.caption, { color: c.success, fontFamily: fonts.mono.medium }]}>+18 ELO</Text>
              </View>
            </View>
            <View style={styles.between}>
              <View style={styles.playerChip}>
                <AppAvatar avatarId="av_1" name="You" size="sm" status="online" />
                <Text style={[type.smallStrong, { color: c.text }]}>You</Text>
              </View>
              <Text style={[type.caption, { color: c.textSecondary }]}>VS</Text>
              <View style={styles.playerChip}>
                <Text style={[type.smallStrong, { color: c.text }]}>Rival</Text>
                <AppAvatar avatarId="av_2" name="Rival" size="sm" status="online" />
              </View>
            </View>
          </AppCard>
        )}

        <View style={{ gap: 10, paddingHorizontal: 8 }}>
          <Text style={[styles.title, { color: c.text }]}>{content.title}</Text>
          <Text style={[type.body, { color: c.textSecondary, textAlign: 'center', lineHeight: 22 }]}>{content.desc}</Text>
        </View>
      </View>

      <View style={{ gap: 20 }}>
        <View style={styles.dots}>
          {([1, 2, 3] as const).map((d) => (
            <Pressy
              key={d}
              accessibilityLabel={`Onboarding step ${d}`}
              hitSlop={12}
              onPress={() => nav.navigate(STEP_ROUTES[d])}
              style={[styles.dot, { width: d === step ? 28 : 8, backgroundColor: d === step ? c.accent : c.border }]}
            />
          ))}
        </View>
        <AppButton testID="onboarding-next" title={content.cta} fullWidth onPress={next} />
      </View>
    </Screen>
  );
};

export const Onboarding1Screen: React.FC<RootScreenProps<'onboarding_1'>> = () => <OnboardingPage step={1} />;
export const Onboarding2Screen: React.FC<RootScreenProps<'onboarding_2'>> = () => <OnboardingPage step={2} />;
export const Onboarding3Screen: React.FC<RootScreenProps<'onboarding_3'>> = () => <OnboardingPage step={3} />;

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skip: { minHeight: 44, minWidth: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  botRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  botHighlight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderRadius: 10 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eloBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  playerChip: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...type.title, textAlign: 'center' },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  dot: { height: 8, borderRadius: 4 },
});
