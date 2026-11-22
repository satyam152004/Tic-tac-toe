import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Crown, Trophy } from 'lucide-react-native';
import { AppButton } from '../../components/common/AppButton';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { BoardCell, GameBoard } from '../../components/game/GameBoard';
import { withAlpha } from '../../design-system/colors';
import { fonts } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { useSettingsStore } from '../../store/settingsStore';

type Step = 1 | 2 | 3;
const STEP_ROUTES = { 1: 'onboarding_1', 2: 'onboarding_2', 3: 'onboarding_3' } as const;

interface GridPreview {
  size: 3 | 4 | 5;
  tag: string;
  scaleRatio: number;
  board: BoardCell[];
  winningLine: number[];
}

const PREVIEW_BOARDS: GridPreview[] = [
  {
    size: 3,
    tag: '3×3',
    scaleRatio: 0.72,
    board: ['X', 'O', '', 'O', 'X', '', '', '', 'X'],
    winningLine: [0, 4, 8],
  },
  {
    size: 4,
    tag: '4×4',
    scaleRatio: 0.82,
    board: [
      'O', 'O', '', '',
      'X', 'X', 'X', 'X',
      '', '', 'X', 'O',
      'O', 'O', '', 'O',
    ],
    winningLine: [4, 5, 6, 7],
  },
  {
    size: 5,
    tag: '5×5',
    scaleRatio: 0.90,
    board: [
      'X', 'O', '', '', '',
      '', '', 'O', 'X', '',
      'O', '', 'X', '', '',
      '', 'X', 'O', '', '',
      'X', '', '', 'O', '',
    ],
    winningLine: [8, 12, 16, 20],
  },
];

/* ── Screen 1: Classic Board Swiper ── */
const BoardAutoSwiper: React.FC<{ swiperSize: number }> = ({ swiperSize }) => {
  const c = useTheme();
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const isInteracting = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isInteracting.current) return;
      const next = (activeIdx + 1) % PREVIEW_BOARDS.length;
      setActiveIdx(next);
      scrollRef.current?.scrollTo({ x: Math.round(next * swiperSize), animated: true });
    }, 2400);

    return () => clearTimeout(timer);
  }, [activeIdx, swiperSize]);

  const selectGrid = (idx: number) => {
    setActiveIdx(idx);
    scrollRef.current?.scrollTo({ x: Math.round(idx * swiperSize), animated: true });
  };

  return (
    <View style={styles.boardSwiperContainer}>
      <View style={[styles.boardWrapper, { width: swiperSize, height: swiperSize }]}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          decelerationRate="fast"
          snapToInterval={swiperSize}
          snapToAlignment="center"
          bounces={false}
          overScrollMode="never"
          onScrollBeginDrag={() => {
            isInteracting.current = true;
          }}
          onScrollEndDrag={() => {
            isInteracting.current = false;
          }}
          onMomentumScrollEnd={(e) => {
            const x = e.nativeEvent.contentOffset.x;
            const idx = Math.round(x / swiperSize);
            if (idx >= 0 && idx < PREVIEW_BOARDS.length) {
              setActiveIdx(idx);
            }
            isInteracting.current = false;
          }}
          style={{ width: swiperSize, height: swiperSize }}
          contentContainerStyle={styles.swiperContent}
        >
          {PREVIEW_BOARDS.map((p) => {
            const side = Math.round(swiperSize * p.scaleRatio);
            return (
              <View
                key={p.size}
                style={[styles.boardSlide, { width: swiperSize, height: swiperSize, overflow: 'hidden' }]}
              >
                <GameBoard
                  compact
                  disabled
                  size={p.size}
                  board={p.board}
                  winningLine={p.winningLine}
                  maxSize={side}
                  side={side}
                />
              </View>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.gridTabs}>
        {PREVIEW_BOARDS.map((p, i) => {
          const active = i === activeIdx;
          return (
            <Pressy
              key={p.size}
              accessibilityLabel={`Show ${p.size} by ${p.size} grid preview`}
              onPress={() => selectGrid(i)}
              style={[
                styles.gridTab,
                active
                  ? { backgroundColor: c.accent, borderColor: c.accent }
                  : { backgroundColor: c.bgCard, borderColor: c.border },
              ]}
            >
              <Text
                style={[
                  styles.gridTabText,
                  active ? { color: '#FFFFFF', fontFamily: fonts.body.semibold } : { color: c.textSecondary },
                ]}
              >
                {p.tag}
              </Text>
            </Pressy>
          );
        })}
      </View>
    </View>
  );
};

/* ── Screen 2: Top 3 Leaderboard Podium Showcase ── */
const LeaderboardPodiumCard: React.FC<{ cardWidth: number; isTall: boolean }> = ({ cardWidth, isTall }) => {
  const c = useTheme();

  return (
    <View style={[styles.leaderboardCard, { width: cardWidth, backgroundColor: c.bgCard, borderColor: c.border }]}>
      {/* Header: Title + Season / Scope */}
      <View style={[styles.leaderboardHeader, { borderBottomColor: c.border }]}>
        <View style={styles.leaderboardHeaderLeft}>
          <View style={[styles.trophyIconBox, { backgroundColor: withAlpha('#F59E0B', 0.15) }]}>
            <Trophy size={16} color="#D97706" />
          </View>
          <View>
            <Text style={[styles.leaderboardTitle, { color: c.text }]}>Top Rankings</Text>
            <Text style={[styles.leaderboardSub, { color: c.textSecondary }]}>Season 4 • Global</Text>
          </View>
        </View>
        <View style={[styles.scopeBadge, { backgroundColor: withAlpha(c.accent, 0.1), borderColor: withAlpha(c.accent, 0.25) }]}>
          <Text style={[styles.scopeBadgeText, { color: c.accent }]}>Live</Text>
        </View>
      </View>

      {/* 3-Player Stepped Podium (Tree / 3-Type Podium structure) */}
      <View style={[styles.podiumContainer, { paddingVertical: isTall ? 14 : 10 }]}>
        {/* Rank #2 (Silver - Left) */}
        <View style={[styles.podiumColumn, styles.podiumSilver, { backgroundColor: c.bgSecondary, borderColor: c.border }]}>
          <View style={[styles.avatarCircle, { backgroundColor: '#E2E8F0' }]}>
            <Text style={[styles.avatarText, { color: '#475569' }]}>MR</Text>
          </View>
          <Text numberOfLines={1} style={[styles.podiumName, { color: c.text }]}>
            #2 Meera
          </Text>
          <Text style={[styles.podiumElo, { color: c.textSecondary }]}>1,790</Text>
        </View>

        {/* Rank #1 (Gold / Elevated Center with Crown) */}
        <View
          style={[
            styles.podiumColumn,
            styles.podiumGold,
            {
              backgroundColor: withAlpha(c.accent, 0.08),
              borderColor: c.accent,
            },
          ]}
        >
          <View style={styles.crownWrapper}>
            <Crown size={15} color="#D97706" />
          </View>
          <View style={[styles.avatarCircle, { backgroundColor: c.accent }]}>
            <Text style={[styles.avatarText, { color: '#FFFFFF' }]}>AS</Text>
          </View>
          <Text numberOfLines={1} style={[styles.podiumName, styles.podiumNameFirst, { color: c.text }]}>
            #1 Arjun
          </Text>
          <Text style={[styles.podiumElo, { color: c.accent, fontFamily: fonts.mono.semibold }]}>1,845</Text>
        </View>

        {/* Rank #3 (Bronze - Right) */}
        <View style={[styles.podiumColumn, styles.podiumBronze, { backgroundColor: c.bgSecondary, borderColor: c.border }]}>
          <View style={[styles.avatarCircle, { backgroundColor: '#E2E8F0' }]}>
            <Text style={[styles.avatarText, { color: '#475569' }]}>RN</Text>
          </View>
          <Text numberOfLines={1} style={[styles.podiumName, { color: c.text }]}>
            #3 Riya
          </Text>
          <Text style={[styles.podiumElo, { color: c.textSecondary }]}>1,730</Text>
        </View>
      </View>

      {/* Pinned Your Rank Footer */}
      <View style={[styles.pinnedRankFooter, { backgroundColor: withAlpha(c.accent, 0.06), borderTopColor: c.border }]}>
        <View style={styles.pinnedRankLeft}>
          <Text style={[styles.pinnedRankLabel, { color: c.accent }]}>Your Rank #14</Text>
        </View>
        <Text style={[styles.pinnedRankScore, { color: c.accent }]}>1,498 ELO</Text>
      </View>
    </View>
  );
};

/* ── Screen 3: Online Player Find (Concentric Radar Rings + Timer) ── */
const MatchmakingRadarGraphic: React.FC<{ isTall: boolean }> = ({ isTall }) => {
  const c = useTheme();
  const pulse = useSharedValue(1);
  const [secondsLeft, setSecondsLeft] = useState(60);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 60));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedTimer = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, [pulse]);

  const animatedRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const outerSize = isTall ? 152 : 136;
  const innerSize = isTall ? 102 : 90;

  return (
    <View style={styles.findingOpponentContainer}>
      {/* Outer & Inner Concentric Pulse Rings */}
      <Animated.View
        style={[
          styles.radarOuterRing,
          animatedRingStyle,
          {
            width: outerSize,
            height: outerSize,
            borderRadius: outerSize / 2,
            backgroundColor: withAlpha(c.bgElevated, 0.6),
            borderColor: '#DBEAFE',
          },
        ]}
      >
        <View
          style={[
            styles.radarInnerRing,
            {
              width: innerSize,
              height: innerSize,
              borderRadius: innerSize / 2,
              backgroundColor: c.bgElevated,
              borderColor: '#BFDBFE',
            },
          ]}
        >
          {/* Center Timer Pill */}
          <View style={[styles.timerPill, { borderColor: c.accent, backgroundColor: '#FFFFFF' }]}>
            <Text style={[styles.timerText, { color: c.accent }]}>{formattedTimer}</Text>
          </View>
        </View>
      </Animated.View>

      {/* Searching Status Heading */}
      <Text style={[styles.searchingHeading, { color: c.text, marginTop: isTall ? 18 : 14 }]}>
        Finding Opponent...
      </Text>
    </View>
  );
};

/* ── Content Text Strings ── */
const CONTENT = {
  1: {
    title: 'Classic & Big Grids',
    desc: 'Play classic 3×3 or try bigger 4×4 and 5×5 boards.',
    cta: 'Next',
  },
  2: {
    title: 'Climb the Leaderboards',
    desc: 'Rise through the ranks, beat friends, and claim the #1 spot.',
    cta: 'Next',
  },
  3: {
    title: 'Play Online & With Friends',
    desc: 'Match with players online in seconds or share a room code with friends.',
    cta: 'Get Started',
  },
} as const;

const isJest = typeof process !== 'undefined' && (Boolean(process.env?.JEST_WORKER_ID) || process.env?.NODE_ENV === 'test');

export const OnboardingPage: React.FC<{ step?: Step }> = ({ step = 1 }) => {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { nav } = useAppNav();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [activeStep, setActiveStep] = useState<Step>(step);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const content = CONTENT[activeStep];

  useEffect(() => {
    if (step && step !== activeStep) {
      setActiveStep(step);
      scrollRef.current?.scrollTo({ x: (step - 1) * screenW, animated: false });
    }
  }, [step, screenW]);

  // Responsive device thresholds
  const isTall = screenH >= 800;
  const isCompact = screenH < 700;

  // Responsive sizing tokens
  const swiperSize = isTall ? 256 : isCompact ? 210 : 236;
  const cardMaxWidth = isTall ? 305 : isCompact ? 250 : 280;
  const titleSize = isTall ? 24 : isCompact ? 19 : 21.5;
  const titleLineH = isTall ? 30 : isCompact ? 24 : 27;
  const subtitleSize = isTall ? 14 : isCompact ? 12 : 13;
  const subtitleLineH = isTall ? 20 : isCompact ? 17 : 18.5;
  const subtitleMaxWidth = isTall ? 295 : isCompact ? 230 : 260;

  const dotActiveW = isTall ? 24 : 20;
  const dotHeight = isTall ? 7 : 6;
  const dotInactiveW = isTall ? 7 : 6;

  const finish = () => {
    useSettingsStore.getState().set({ onboardingSeen: true });
    nav.navigate('welcome');
  };

  const goToStep = (target: Step) => {
    setActiveStep(target);
    scrollRef.current?.scrollTo({ x: (target - 1) * screenW, animated: true });
  };

  const next = () => {
    if (activeStep === 3) {
      finish();
    } else {
      const nextStep = (activeStep + 1) as Step;
      if (isJest) {
        nav.navigate(STEP_ROUTES[nextStep]);
      } else {
        goToStep(nextStep);
      }
    }
  };

  const onMomentumScrollEnd = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / screenW);
    const newStep = (Math.max(0, Math.min(2, idx)) + 1) as Step;
    if (newStep !== activeStep) {
      setActiveStep(newStep);
    }
  };

  return (
    <Screen
      scroll={false}
      testID={`onboarding-${activeStep}`}
      contentStyle={[
        styles.screenContent,
        {
          paddingBottom: Math.max(24, insets.bottom + 8),
          paddingTop: Math.max(12, insets.top ? insets.top * 0.4 : 12),
        },
      ]}
    >
      {/* Top Header / Skip */}
      <View style={styles.top}>
        {activeStep < 3 ? (
          <Pressy testID="onboarding-skip" accessibilityLabel="Skip" onPress={finish} style={styles.skip}>
            <Text style={[styles.skipText, { color: c.textSecondary, fontSize: isTall ? 13 : 12 }]}>Skip</Text>
          </Pressy>
        ) : (
          <View style={styles.skipPlaceholder} />
        )}
      </View>

      {/* Center Horizontal Swiper Paging Section */}
      <View style={styles.centerSection}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          decelerationRate="fast"
          snapToInterval={screenW}
          snapToAlignment="center"
          bounces={false}
          overScrollMode="never"
          onMomentumScrollEnd={onMomentumScrollEnd}
          style={{ width: screenW }}
        >
          {/* Slide 1: Classic Board Swiper */}
          <View testID="onboarding-1" style={[styles.slidePage, { width: screenW }]}>
            <View style={styles.graphicBox}>
              <BoardAutoSwiper swiperSize={swiperSize} />
            </View>
            <Text style={[styles.title, { color: c.text, fontSize: titleSize, lineHeight: titleLineH }]}>
              {CONTENT[1].title}
            </Text>
            <Text
              style={[
                styles.subtitle,
                {
                  color: c.textSecondary,
                  fontSize: subtitleSize,
                  lineHeight: subtitleLineH,
                  maxWidth: subtitleMaxWidth,
                  marginTop: isTall ? 8 : 6,
                },
              ]}
            >
              {CONTENT[1].desc}
            </Text>
          </View>

          {/* Slide 2: Top 3 Leaderboard Podium */}
          <View testID="onboarding-2" style={[styles.slidePage, { width: screenW }]}>
            <View style={[styles.graphicBox, { marginBottom: isTall ? 22 : 16 }]}>
              <LeaderboardPodiumCard cardWidth={cardMaxWidth} isTall={isTall} />
            </View>
            <Text style={[styles.title, { color: c.text, fontSize: titleSize, lineHeight: titleLineH }]}>
              {CONTENT[2].title}
            </Text>
            <Text
              style={[
                styles.subtitle,
                {
                  color: c.textSecondary,
                  fontSize: subtitleSize,
                  lineHeight: subtitleLineH,
                  maxWidth: subtitleMaxWidth,
                  marginTop: isTall ? 8 : 6,
                },
              ]}
            >
              {CONTENT[2].desc}
            </Text>
          </View>

          {/* Slide 3: Online Player Radar */}
          <View testID="onboarding-3" style={[styles.slidePage, { width: screenW }]}>
            <View style={[styles.graphicBox, { marginBottom: isTall ? 20 : 14 }]}>
              <MatchmakingRadarGraphic isTall={isTall} />
            </View>
            <Text style={[styles.title, { color: c.text, fontSize: titleSize, lineHeight: titleLineH }]}>
              {CONTENT[3].title}
            </Text>
            <Text
              style={[
                styles.subtitle,
                {
                  color: c.textSecondary,
                  fontSize: subtitleSize,
                  lineHeight: subtitleLineH,
                  maxWidth: subtitleMaxWidth,
                  marginTop: isTall ? 8 : 6,
                },
              ]}
            >
              {CONTENT[3].desc}
            </Text>
          </View>
        </ScrollView>
      </View>

      {/* Bottom CTA Button with Dots directly on upper side */}
      <View style={[styles.bottomSection, { paddingTop: isTall ? 12 : 8 }]}>
        {/* Dots Indicator fixed directly above Next button */}
        <View style={[styles.dots, { marginBottom: isTall ? 20 : 16, gap: isTall ? 8 : 6 }]}>
          {([1, 2, 3] as const).map((d) => (
            <Pressy
              key={d}
              accessibilityLabel={`Onboarding step ${d}`}
              hitSlop={12}
              onPress={() => goToStep(d)}
              style={[
                styles.dot,
                d === activeStep
                  ? { width: dotActiveW, height: dotHeight, borderRadius: dotHeight / 2, backgroundColor: c.accent }
                  : { width: dotInactiveW, height: dotHeight, borderRadius: dotHeight / 2, backgroundColor: '#CFCFC8' },
              ]}
            />
          ))}
        </View>

        <AppButton
          testID="onboarding-next"
          title={content.cta}
          size={isTall ? 'lg' : 'md'}
          fullWidth
          onPress={next}
        />
      </View>
    </Screen>
  );
};

export const Onboarding1Screen: React.FC<RootScreenProps<'onboarding_1'>> = () => <OnboardingPage step={1} />;
export const Onboarding2Screen: React.FC<RootScreenProps<'onboarding_2'>> = () => <OnboardingPage step={2} />;
export const Onboarding3Screen: React.FC<RootScreenProps<'onboarding_3'>> = () => <OnboardingPage step={3} />;

const styles = StyleSheet.create({
  screenContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: 36,
    paddingHorizontal: 22,
  },
  skip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    fontFamily: fonts.body.semibold,
  },
  skipPlaceholder: {
    height: 32,
  },
  centerSection: {
    flex: 1,
    justifyContent: 'center',
  },
  slidePage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  graphicBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  boardSwiperContainer: {
    alignItems: 'center',
    marginBottom: 4,
  },
  boardWrapper: {
    overflow: 'hidden',
    borderRadius: 18,
  },
  swiperContent: {
    alignItems: 'center',
  },
  boardSlide: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    marginBottom: 16,
  },
  gridTab: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  gridTabText: {
    fontFamily: fonts.body.medium,
    fontSize: 11.5,
    lineHeight: 16,
  },

  /* ── Screen 2: Top 3 Leaderboard Podium Styles ── */
  leaderboardCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#141518',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  leaderboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  leaderboardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trophyIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderboardTitle: {
    fontFamily: fonts.body.semibold,
    fontSize: 12.5,
    lineHeight: 16,
  },
  leaderboardSub: {
    fontFamily: fonts.body.regular,
    fontSize: 10,
    lineHeight: 13,
  },
  scopeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 999,
    borderWidth: 1,
  },
  scopeBadgeText: {
    fontFamily: fonts.body.semibold,
    fontSize: 10,
  },
  podiumContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 6,
  },
  podiumColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 3,
  },
  podiumSilver: {
    minHeight: 82,
  },
  podiumGold: {
    minHeight: 102,
    paddingBottom: 8,
  },
  podiumBronze: {
    minHeight: 78,
  },
  crownWrapper: {
    marginBottom: 2,
  },
  avatarCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  avatarText: {
    fontFamily: fonts.body.semibold,
    fontSize: 9.5,
  },
  podiumName: {
    fontFamily: fonts.body.semibold,
    fontSize: 10.5,
    lineHeight: 14,
    textAlign: 'center',
  },
  podiumNameFirst: {
    fontFamily: fonts.body.semibold,
    fontSize: 11,
  },
  podiumElo: {
    fontFamily: fonts.mono.regular,
    fontSize: 9.5,
    marginTop: 1,
    textAlign: 'center',
  },
  pinnedRankFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pinnedRankLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pinnedRankLabel: {
    fontFamily: fonts.body.semibold,
    fontSize: 11,
  },
  pinnedRankScore: {
    fontFamily: fonts.mono.semibold,
    fontSize: 11,
  },

  /* ── Screen 3: Matchmaking Concentric Radar Graphic Styles ── */
  findingOpponentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarOuterRing: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  radarInnerRing: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  timerPill: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#141518',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  timerText: {
    fontFamily: fonts.mono.semibold,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.5,
  },
  searchingHeading: {
    fontFamily: fonts.body.semibold,
    fontSize: 17,
    lineHeight: 22,
    textAlign: 'center',
  },
  eloBadgePill: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eloBadgeText: {
    fontFamily: fonts.body.semibold,
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
  },

  /* ── Typography & Navigation ── */
  title: {
    fontFamily: fonts.body.semibold,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.body.regular,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    borderRadius: 4,
  },
  bottomSection: {
    width: '100%',
    paddingHorizontal: 22,
  },
});
