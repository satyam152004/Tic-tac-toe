import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { BookOpen, Bot, Globe, UserCheck, Users } from 'lucide-react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppIconButton } from '../../components/common/AppIconButton';
import { Screen } from '../../components/common/Screen';
import { fonts } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';

type ModeKey = 'ai' | 'local' | 'online' | 'friends';

interface ModeOption {
  key: ModeKey;
  testID: string;
  title: string;
  sub: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  isOnline?: boolean;
}

const MODES: ModeOption[] = [
  {
    key: 'ai',
    testID: 'mode-ai',
    title: 'vs AI Bot',
    sub: 'Offline practice against calibrated bot',
    icon: Bot,
  },
  {
    key: 'local',
    testID: 'mode-local',
    title: 'Pass & Play',
    sub: 'Alternating turns on one device',
    icon: Users,
  },
  {
    key: 'online',
    testID: 'mode-online',
    title: 'Online Ranked',
    sub: 'Rated 1v1 matchmaking near your ELO',
    icon: Globe,
    isOnline: true,
  },
  {
    key: 'friends',
    testID: 'mode-friends',
    title: 'Play with Friends',
    sub: 'Create a private room code & invite friends',
    icon: UserCheck,
    isOnline: true,
  },
];

export const GameModeScreen: React.FC = () => {
  const c = useTheme();
  const { nav, back } = useAppNav();
  const offline = useAuthStore((s) => s.offline);
  const [selected, setSelected] = useState<ModeKey>('ai');

  const { height: screenH } = useWindowDimensions();
  const isTall = screenH >= 780;
  const isVeryTall = screenH >= 860;

  const handleProceed = (modeKey: ModeKey) => {
    if ((modeKey === 'online' || modeKey === 'friends') && offline) {
      toast.warning('You are offline', 'Connect to the internet to play online or with friends.');
      return;
    }
    switch (modeKey) {
      case 'ai':
        nav.navigate('ai_difficulty');
        break;
      case 'local':
        nav.navigate('player_setup', { mode: 'LOCAL_2P' });
        break;
      case 'online':
        nav.navigate('online_lobby');
        break;
      case 'friends':
        nav.navigate('create_room');
        break;
    }
  };

  const handleCardPress = (mode: ModeOption) => {
    setSelected(mode.key);
  };

  const cardPad = isVeryTall ? 18 : isTall ? 16 : 14;
  const iconBoxSize = isVeryTall ? 44 : isTall ? 40 : 34;
  const iconSize = isVeryTall ? 21 : isTall ? 19 : 17;
  const cardGap = isVeryTall ? 14 : isTall ? 12 : 10;
  const titleSize = isVeryTall ? 15.5 : isTall ? 14.5 : 13.5;
  const subSize = isVeryTall ? 12 : isTall ? 11.5 : 10.5;
  const radioOuterSize = isVeryTall ? 24 : isTall ? 22 : 20;
  const radioInnerSize = isVeryTall ? 12 : isTall ? 11 : 10;

  return (
    <Screen
      tabs
      title="Select Mode"
      onBack={back}
      testID="game-mode-screen"
      rightAction={
        <AppIconButton
          label="Game rules"
          onPress={() => nav.navigate('game_rules')}
          icon={<BookOpen size={isTall ? 20 : 18} color={c.textSecondary} />}
        />
      }
      footer={
        <AppButton
          title="Continue"
          size={isTall ? 'lg' : 'md'}
          fullWidth
          onPress={() => handleProceed(selected)}
        />
      }
    >
      <View style={[styles.container, { gap: cardGap }]}>
        {MODES.map((m) => {
          const active = selected === m.key;
          const IconComponent = m.icon;

          return (
            <Pressable
              key={m.key}
              testID={m.testID}
              focusable={false}
              android_ripple={{ color: 'transparent' }}
              accessibilityLabel={`${m.title}${active ? ', selected' : ''}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => handleCardPress(m)}
              style={({ pressed }) => [
                styles.modeCard,
                {
                  padding: cardPad,
                  borderRadius: isTall ? 16 : 14,
                  backgroundColor: active
                    ? (c.bgCard === '#FFFFFF' || c.bgCard === '#FFFDF9' ? '#EFF4FF' : c.bgElevated)
                    : c.bgCard,
                  borderColor: active ? c.accent : c.border,
                  borderWidth: active ? 1.5 : 1,
                  opacity: pressed ? 0.94 : 1,
                  transform: [{ scale: pressed ? 0.985 : 1 }],
                },
              ]}
            >
              <View style={styles.cardLeft}>
                <View
                  style={[
                    styles.iconSquircle,
                    {
                      width: iconBoxSize,
                      height: iconBoxSize,
                      borderRadius: isTall ? 11 : 9,
                      backgroundColor: active ? '#FFFFFF' : (c.bgCard === '#FFFFFF' || c.bgCard === '#FFFDF9' ? '#F8F8F6' : c.bgElevated),
                      borderColor: active ? '#BFDBFE' : c.border,
                    },
                  ]}
                >
                  <IconComponent size={iconSize} color={active ? c.accent : c.text} />
                </View>

                <View style={styles.textCol}>
                  <Text
                    style={[
                      styles.modeTitle,
                      { color: c.text, fontSize: titleSize },
                    ]}
                  >
                    {m.title}
                  </Text>
                  <Text
                    style={[
                      styles.modeSubtitle,
                      { color: c.textSecondary, fontSize: subSize },
                    ]}
                  >
                    {m.sub}
                  </Text>
                </View>
              </View>

              {/* Clean Cross-Platform Radio Indicator */}
              <View
                style={[
                  styles.radioOuter,
                  {
                    width: radioOuterSize,
                    height: radioOuterSize,
                    borderRadius: radioOuterSize / 2,
                    borderColor: active ? c.accent : '#CFCFC8',
                    borderWidth: active ? 5 : 1.5,
                    backgroundColor: '#FFFFFF',
                  },
                ]}
              >
                {active ? (
                  <View
                    style={{
                      width: radioInnerSize,
                      height: radioInnerSize,
                      borderRadius: radioInnerSize / 2,
                      backgroundColor: c.accent,
                    }}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 6,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 0,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconSquircle: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  modeTitle: {
    fontFamily: fonts.body.semibold,
  },
  modeSubtitle: {
    fontFamily: fonts.body.regular,
  },
  radioOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
