import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { fonts } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { useSettingsStore } from '../../store/settingsStore';
import {
  ACCENT_SOFT,
  BORDER_STRONG,
  CheckIcon,
  MarkO,
  MarkX,
  MUTED,
  ProtoButton,
  SUCCESS,
  SUCCESS_SOFT,
} from '../auth/protoUi';

type Step = 1 | 2 | 3;
const STEP_ROUTES = { 1: 'onboarding_1', 2: 'onboarding_2', 3: 'onboarding_3' } as const;

const CONTENT = {
  1: {
    title: 'Pure Classic Strategy',
    desc: 'Master classic 3×3 or expand to 4×4 and 5×5 tactical grids.',
    cta: 'Next',
  },
  2: {
    title: 'Three Bot Levels',
    desc: 'Warm up on Casual or test your calculation against our Minimax engine.',
    cta: 'Next',
  },
  3: {
    title: 'Instant 1v1 & Rooms',
    desc: 'Climb the ranked leaderboard or share a private room code with friends.',
    cta: 'Get Started',
  },
} as const;

/* ── Slide 1: 3x3 board illustration (`miniBoard` at 178px, 20px marks) ── */
const BOARD = ['X', 'O', '', 'O', 'X', '', '', '', 'X'] as const;
const WIN_LINE = [0, 4, 8];

const BoardIllustration: React.FC = () => {
  const c = useTheme();
  return (
    <View style={[styles.board, { backgroundColor: c.bgCard, borderColor: c.border }]}>
      {BOARD.map((v, i) => {
        const win = WIN_LINE.includes(i);
        return (
          <View
            key={i}
            style={[
              styles.boardCell,
              win ? { backgroundColor: ACCENT_SOFT, borderWidth: 1, borderColor: '#BFDBFE' } : { backgroundColor: '#F1F1EE' },
            ]}
          >
            {v === 'X' ? <MarkX size={20} stroke={2.7} /> : v === 'O' ? <MarkO size={20} stroke={2.7} /> : null}
          </View>
        );
      })}
    </View>
  );
};

/* ── Slide 2: bot level list ── */
const BotLevels: React.FC = () => {
  const c = useTheme();
  const rows = [
    { name: 'Casual Bot', level: 'Level 1', active: false },
    { name: 'Tactical Bot', level: 'Level 2', active: false },
    { name: 'Unbeatable Minimax', level: null, active: true },
  ];
  return (
    <View style={[styles.group, { backgroundColor: c.bgCard, borderColor: c.border }]}>
      {rows.map((r, i) => (
        <View
          key={r.name}
          style={[
            styles.groupRow,
            { minHeight: r.active ? 36 : 34 },
            i > 0 ? { borderTopWidth: 1, borderTopColor: c.border } : null,
            r.active ? { backgroundColor: 'rgba(239,244,255,0.6)' } : null,
          ]}
        >
          <Text style={[r.active ? styles.botNameActive : styles.botName, { color: r.active ? c.accent : c.textSecondary }]}>{r.name}</Text>
          {r.level ? <Text style={[styles.botLevel, { color: MUTED }]}>{r.level}</Text> : <CheckIcon size={13} color={c.accent} />}
        </View>
      ))}
    </View>
  );
};

/* ── Slide 3: ranked arena card ── */
const ArenaCard: React.FC = () => {
  const c = useTheme();
  return (
    <View style={[styles.arena, { backgroundColor: c.bgCard, borderColor: c.border }]}>
      <View style={styles.arenaTop}>
        <Text style={[styles.arenaLabel, { color: c.accent }]}>1v1 RANKED ARENA</Text>
        <View style={styles.eloPill}>
          <Text style={styles.eloText}>+18 ELO</Text>
        </View>
      </View>
      <View style={styles.arenaVs}>
        <View style={styles.arenaPlayer}>
          <View style={[styles.avatar, { backgroundColor: c.accent }]}>
            <Text style={styles.avatarText}>SP</Text>
          </View>
          <Text style={[styles.playerName, { color: c.text }]}>You</Text>
        </View>
        <Text style={[styles.vs, { color: MUTED }]}>VS</Text>
        <View style={styles.arenaPlayer}>
          <Text style={[styles.playerName, { color: c.text }]}>Aarav</Text>
          <View style={[styles.avatar, { backgroundColor: '#141518' }]}>
            <Text style={styles.avatarText}>AK</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const Dots: React.FC<{ step: Step }> = ({ step }) => {
  const c = useTheme();
  return (
    <View style={styles.dots} accessibilityLabel={`Onboarding step ${step} of 3`}>
      {([1, 2, 3] as const).map((d) => (
        <View
          key={d}
          style={d === step ? { width: 20, height: 6, borderRadius: 3, backgroundColor: c.accent } : { width: 6, height: 6, borderRadius: 3, backgroundColor: BORDER_STRONG }}
        />
      ))}
    </View>
  );
};

export const OnboardingPage: React.FC<{ step?: Step }> = ({ step = 1 }) => {
  const c = useTheme();
  const { nav } = useAppNav();
  const content = CONTENT[step];

  const finish = () => {
    useSettingsStore.getState().set({ onboardingSeen: true });
    nav.navigate('welcome');
  };

  const next = () => {
    if (step === 3) finish();
    else nav.navigate(STEP_ROUTES[(step + 1) as Step]);
  };

  return (
    <Screen scroll={false} padded={false} gap={0} testID={`onboarding-${step}`}>
      <View style={styles.screen}>
      <View style={styles.top}>
        {step < 3 ? (
          <Pressy testID="onboarding-skip" accessibilityLabel="Skip" onPress={finish} hitSlop={12}>
            <Text style={[styles.skip, { color: c.textSecondary }]}>Skip</Text>
          </Pressy>
        ) : (
          <Text style={[styles.skip, { color: 'transparent' }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">Skip</Text>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.center}>
          {step === 1 ? <BoardIllustration /> : step === 2 ? <BotLevels /> : <ArenaCard />}
          <Text style={[styles.title, { color: c.text }]}>{content.title}</Text>
          <Text style={[styles.desc, { color: c.textSecondary }]}>{content.desc}</Text>
          <Dots step={step} />
        </View>
        <View style={styles.footer}>
          <ProtoButton testID="onboarding-next" title={content.cta} onPress={next} />
        </View>
      </View>
      </View>
    </Screen>
  );
};

export const Onboarding1Screen: React.FC<RootScreenProps<'onboarding_1'>> = () => <OnboardingPage step={1} />;
export const Onboarding2Screen: React.FC<RootScreenProps<'onboarding_2'>> = () => <OnboardingPage step={2} />;
export const Onboarding3Screen: React.FC<RootScreenProps<'onboarding_3'>> = () => <OnboardingPage step={3} />;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { paddingHorizontal: 20, paddingTop: 8, flexDirection: 'row', justifyContent: 'flex-end' },
  skip: { fontFamily: fonts.body.semibold, fontSize: 12, lineHeight: 16 },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingTop: 8 },

  board: { width: 178, height: 178, borderRadius: 16, borderWidth: 1, padding: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  boardCell: { width: 46, height: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  group: { width: '100%', maxWidth: 232, borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 20 },
  groupRow: { paddingHorizontal: 13, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  botName: { fontFamily: fonts.body.medium, fontSize: 11.5 },
  botNameActive: { fontFamily: fonts.body.semibold, fontSize: 11.5 },
  botLevel: { fontFamily: fonts.body.regular, fontSize: 10.5 },

  arena: { width: '100%', maxWidth: 232, borderRadius: 14, borderWidth: 1, padding: 14, gap: 8, marginBottom: 20 },
  arenaTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arenaLabel: { fontFamily: fonts.body.semibold, fontSize: 10, letterSpacing: 0.5 },
  eloPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, backgroundColor: SUCCESS_SOFT },
  eloText: { fontFamily: fonts.mono.semibold, fontSize: 10, color: SUCCESS },
  arenaVs: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 },
  arenaPlayer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avatar: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.body.semibold, fontSize: 9.5, color: '#FFFFFF' },
  playerName: { fontFamily: fonts.body.semibold, fontSize: 11.5 },
  vs: { fontFamily: fonts.body.semibold, fontSize: 11 },

  title: { fontFamily: fonts.body.semibold, fontSize: 19, lineHeight: 24, letterSpacing: -0.38, textAlign: 'center' },
  desc: { fontFamily: fonts.body.regular, fontSize: 12.5, lineHeight: 18, marginTop: 6, maxWidth: 248, textAlign: 'center' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20 },
});
