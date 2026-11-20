import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ban, ChevronRight, Eye, ShieldCheck, UserCheck } from 'lucide-react-native';
import { AppCard } from '../../components/common/AppCard';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import type { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';
import { FriendRequestPolicy, useSettingsStore } from '../../store/settingsStore';
import { toast } from '../../store/toastStore';
import { ToggleSwitch } from './SettingsScreen';

const POLICIES: FriendRequestPolicy[] = ['Everyone', 'Mutuals', 'Off'];

export const PrivacySettingsScreen: React.FC<RootScreenProps<'privacy_settings'>> = () => {
  const c = useTheme();
  const { goTab, back } = useAppNav();
  const settings = useSettingsStore();

  const updatePolicy = (policy: FriendRequestPolicy) => {
    settings.set({ privacyRequests: policy });
    toast.info('Privacy updated', `Friend requests: ${policy}`);
  };

  return (
    <Screen title="Privacy & Safety" onBack={back} testID="privacy-settings-screen">
      <AppCard style={{ gap: 14 }}>
        <Text style={[type.smallStrong, { color: c.textSecondary }]}>Visibility</Text>
        <View style={styles.row}>
          <Eye size={16} color={c.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[type.bodyStrong, { color: c.text }]}>Online Presence</Text>
            <Text style={[type.caption, { color: c.textSecondary }]}>Show when you are active in the arena</Text>
          </View>
          <ToggleSwitch
            testID="privacy-online"
            label="Toggle online presence"
            checked={settings.privacyOnline}
            onChange={() => settings.set({ privacyOnline: !settings.privacyOnline })}
          />
        </View>

        <View style={styles.row}>
          <ShieldCheck size={16} color={c.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[type.bodyStrong, { color: c.text }]}>Allow Friend Spectating</Text>
            <Text style={[type.caption, { color: c.textSecondary }]}>Let friends watch your live ranked games</Text>
          </View>
          <ToggleSwitch
            testID="privacy-spectate"
            label="Toggle friend spectating"
            checked={settings.privacySpectate}
            onChange={() => settings.set({ privacySpectate: !settings.privacySpectate })}
          />
        </View>

        <View style={styles.row}>
          <UserCheck size={16} color={c.success} />
          <View style={{ flex: 1 }}>
            <Text style={[type.bodyStrong, { color: c.text }]}>Show ELO on Profile</Text>
            <Text style={[type.caption, { color: c.textSecondary }]}>Display your rating on public player cards</Text>
          </View>
          <ToggleSwitch
            testID="privacy-elo"
            label="Toggle public ELO"
            checked={settings.privacyPublicElo}
            onChange={() => settings.set({ privacyPublicElo: !settings.privacyPublicElo })}
          />
        </View>
      </AppCard>

      <AppCard style={{ gap: 12 }}>
        <Text style={[type.smallStrong, { color: c.textSecondary }]}>Who can send friend requests</Text>
        <View style={[styles.segments, { backgroundColor: c.bgSecondary, borderColor: c.border }]}>
          {POLICIES.map((p) => {
            const active = settings.privacyRequests === p;
            return (
              <Pressy
                key={p}
                testID={`privacy-policy-${p}`}
                accessibilityLabel={p}
                accessibilityState={{ selected: active }}
                onPress={() => updatePolicy(p)}
                style={[styles.segment, { backgroundColor: active ? c.accentFill : 'transparent' }]}
              >
                <Text style={[type.smallStrong, { color: active ? c.onAccent : c.textSecondary }]}>{p}</Text>
              </Pressy>
            );
          })}
        </View>
      </AppCard>

      <AppCard padding="sm" onPress={() => goTab('FriendsTab')} testID="privacy-blocked">
        <View style={styles.row}>
          <Ban size={16} color={c.dangerText} />
          <Text style={[type.bodyStrong, { color: c.text, flex: 1 }]}>Manage Blocked Players</Text>
          <ChevronRight size={16} color={c.textSecondary} />
        </View>
      </AppCard>
    </Screen>
  );
};

const styles = StyleSheet.create({
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
  segments: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: 12, borderWidth: 1 },
  segment: { flex: 1, minHeight: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});
