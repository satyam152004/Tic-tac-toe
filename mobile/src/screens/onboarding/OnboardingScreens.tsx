import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { AppButton } from '../../components/common/AppButton';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { ONBOARDING_IMAGES } from '../../constants/avatars';
import { fonts, type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { useSettingsStore } from '../../store/settingsStore';

type Step = 1 | 2 | 3;
const STEP_ROUTES = { 1: 'onboarding_1', 2: 'onboarding_2', 3: 'onboarding_3' } as const;

const CONTENT = {
  1: { img: ONBOARDING_IMAGES.classic, alt: 'Isometric glowing Tic Tac Toe crystal game board', title: 'Classic Strategy, Reimagined', desc: 'Master 3x3 classics or expand into 4x4 and 5x5 tactical grids with crisp turn feedback.', cta: 'Next' },
  2: { img: ONBOARDING_IMAGES.ai, alt: 'Tactical AI strategist analyzing strategy grid', title: 'Offline Duels & Smart AI', desc: 'Play pass-and-play with a friend anywhere or challenge AI from Easy up to Impossible.', cta: 'Next' },
  3: { img: ONBOARDING_IMAGES.online, alt: 'Two competitive player crests connected in online arena', title: 'Compete Online Worldwide', desc: 'Join instant quick matches, create private friend rooms, and climb global leaderboards.', cta: 'Get Started' },
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

      <View style={{ gap: 24 }}>
        <View style={[styles.frame, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <Image source={content.img} accessibilityLabel={content.alt} contentFit="cover" style={StyleSheet.absoluteFill} />
        </View>
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
  frame: { width: '100%', aspectRatio: 4 / 3, borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  title: { fontFamily: fonts.display.bold, fontSize: 24, lineHeight: 30, textAlign: 'center' },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  dot: { height: 8, borderRadius: 4 },
});
