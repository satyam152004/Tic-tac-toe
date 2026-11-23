import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GuestUpgradeModal } from '../../components/auth/GuestUpgradeModal';
import { fonts } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import { useAuthStore, useIsGuest } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import { BORDER_STRONG, BotIcon, GlobeIcon, ProtoButton, ProtoHeader, ProtoScreen, UsersIcon } from '../auth/protoUi';

type ModeKey = 'ai' | 'local' | 'online';

interface ModeOption {
  key: ModeKey;
  testID: string;
  title: string;
  sub: string;
  icon: React.ReactNode;
}

const MODES: ModeOption[] = [
  { key: 'ai', testID: 'mode-ai', title: 'vs AI Bot', sub: 'Offline practice against calibrated bot', icon: <BotIcon size={15} /> },
  { key: 'local', testID: 'mode-local', title: 'Pass & Play', sub: 'Alternating turns on one device', icon: <UsersIcon size={15} /> },
  { key: 'online', testID: 'mode-online', title: 'Online Ranked', sub: 'Rated 1v1 matchmaking near your ELO', icon: <GlobeIcon size={15} /> },
];

export const GameModeScreen: React.FC = () => {
  const c = useTheme();
  const { nav, back } = useAppNav();
  const offline = useAuthStore((s) => s.offline);
  const isGuest = useIsGuest();
  const coins = useAuthStore((s) => s.user?.wallet.coins ?? 0);
  const [selected, setSelected] = useState<ModeKey>('ai');
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const proceed = () => {
    switch (selected) {
      case 'ai':
        nav.navigate('ai_difficulty');
        break;
      case 'local':
        // Board size first, then player names / symbols.
        nav.navigate('board_selection', { mode: 'LOCAL_2P' });
        break;
      case 'online':
        if (offline) {
          toast.warning('You are offline', 'Connect to the internet to play online.');
          return;
        }
        if (isGuest) {
          setUpgradeOpen(true);
          return;
        }
        nav.navigate('online_lobby');
        break;
    }
  };

  return (
    <ProtoScreen testID="game-mode-screen" tabs>
      <ProtoHeader title="Select Mode" onBack={back} />
      <View style={styles.body}>
        {MODES.map((m) => {
          const active = selected === m.key;
          return (
            <Pressable
              key={m.key}
              testID={m.testID}
              focusable={false}
              android_ripple={{ color: 'transparent' }}
              accessibilityLabel={`${m.title}${active ? ', selected' : ''}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => setSelected(m.key)}
              style={[
                styles.card,
                active
                  ? { backgroundColor: 'rgba(239,244,255,0.55)', borderColor: c.accent, borderWidth: 1.5 }
                  : { backgroundColor: c.bgCard, borderColor: c.border, borderWidth: 1 },
              ]}
            >
              <View style={styles.left}>
                <View style={[styles.iconBox, { backgroundColor: c.bgCard, borderColor: c.border }]}>{m.icon}</View>
                <View style={styles.textCol}>
                  <Text style={[styles.title, { color: c.text }]}>{m.title}</Text>
                  <Text style={[styles.sub, { color: c.textSecondary }]}>{m.sub}</Text>
                </View>
              </View>
              <View
                style={[
                  styles.radio,
                  active ? { borderWidth: 5, borderColor: c.accent, backgroundColor: c.bgCard } : { borderWidth: 1, borderColor: BORDER_STRONG },
                ]}
              />
            </Pressable>
          );
        })}

        <View style={styles.footer}>
          <ProtoButton testID="mode-continue" title="Continue" onPress={proceed} />
        </View>
      </View>

      <GuestUpgradeModal
        open={upgradeOpen}
        coins={coins}
        onUpgrade={() => {
          setUpgradeOpen(false);
          nav.navigate('registration');
        }}
        onDismiss={() => setUpgradeOpen(false)}
      />
    </ProtoScreen>
  );
};

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 12 },
  card: { padding: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconBox: { width: 32, height: 32, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  textCol: { flex: 1 },
  title: { fontFamily: fonts.body.semibold, fontSize: 13, lineHeight: 18 },
  sub: { fontFamily: fonts.body.regular, fontSize: 11, lineHeight: 15, marginTop: 2 },
  radio: { width: 20, height: 20, borderRadius: 10, marginLeft: 8 },
  footer: { marginTop: 'auto', paddingTop: 8 },
});
