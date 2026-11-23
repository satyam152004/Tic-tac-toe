import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import { AppModal, ConfirmDialog } from '../../components/common/AppModal';
import { Screen } from '../../components/common/Screen';
import { Group, GroupRow, Segmented, SectionLabel } from '../../components/profile/ProtoUi';
import { type } from '../../design-system/typography';
import { useBlocked, useMe } from '../../hooks/queries';
import { usePreferenceSync } from '../../hooks/usePreferenceSync';
import { useTheme } from '../../hooks/useTheme';
import type { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';
import { friendlyMessage } from '../../services/api/errors';
import { useAuthStore } from '../../store/authStore';
import { FriendRequestPolicy, useSettingsStore } from '../../store/settingsStore';
import { toast } from '../../store/toastStore';
import { ToggleSwitch } from './SettingsScreen';

const POLICIES: Array<{ id: FriendRequestPolicy; label: string }> = [
  { id: 'Everyone', label: 'Everyone' },
  { id: 'Mutuals', label: 'Mutuals' },
  { id: 'Off', label: 'Off' },
];

const DeleteAccountModal: React.FC<{ open: boolean; busy: boolean; onClose: () => void; onDelete: (password: string) => void }> = ({ open, busy, onClose, onDelete }) => {
  const c = useTheme();
  const [pw, setPw] = useState('');
  useEffect(() => {
    if (!open) setPw('');
  }, [open]);
  return (
    <AppModal open={open} title="Delete account?" onClose={onClose}>
      <Text style={[type.body, { color: c.textSecondary }]}>This deletes your account, stats and friends for good. Enter your password to confirm.</Text>
      <AppInput testID="delete-password" label="Password" value={pw} onChangeText={setPw} secureToggle autoCapitalize="none" autoCorrect={false} />
      <AppButton testID="delete-confirm" title="Delete forever" variant="danger" fullWidth loading={busy} disabled={pw.length === 0} onPress={() => onDelete(pw)} />
    </AppModal>
  );
};

export const PrivacySettingsScreen: React.FC<RootScreenProps<'privacy_settings'>> = () => {
  const c = useTheme();
  const { goTab, back, resetTo } = useAppNav();
  const settings = useSettingsStore();
  const sync = usePreferenceSync();
  const me = useMe().data;
  const blocked = useBlocked();
  const user = useAuthStore((s) => s.user);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const isGuest = user?.accountType === 'GUEST';
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);

  // The server value is authoritative; the settings store is only a cache of it.
  const serverSpectate = me?.privacy?.allowSpectating;
  useEffect(() => {
    if (serverSpectate !== undefined && serverSpectate !== useSettingsStore.getState().privacySpectate) {
      useSettingsStore.getState().set({ privacySpectate: serverSpectate });
    }
  }, [serverSpectate]);

  const toggleSpectate = () => {
    const next = !settings.privacySpectate;
    sync({ privacySpectate: next }, { privacy: { allowSpectating: next } });
  };
  const toggleOnline = () => settings.set({ privacyOnline: !settings.privacyOnline });
  const toggleElo = () => settings.set({ privacyPublicElo: !settings.privacyPublicElo });

  const updatePolicy = (policy: FriendRequestPolicy) => {
    settings.set({ privacyRequests: policy });
  };

  const doDelete = async (password?: string) => {
    setBusy(true);
    try {
      await deleteAccount(password);
      setDeleting(false);
      resetTo('welcome');
    } catch (e) {
      toast.error("Couldn't delete account", friendlyMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const blockedCount = blocked.data?.items.length;

  return (
    <Screen title="Privacy & Safety" onBack={back} testID="privacy-settings-screen" gap={12}>
      <View>
        <SectionLabel>Visibility</SectionLabel>
        <Group>
          <GroupRow label="Online Status" onPress={toggleOnline} right={<ToggleSwitch testID="privacy-online" label="Toggle online presence" checked={settings.privacyOnline} onChange={toggleOnline} />} />
          <GroupRow label="Friends Can Watch" onPress={toggleSpectate} right={<ToggleSwitch testID="privacy-spectate" label="Toggle friend spectating" checked={settings.privacySpectate} onChange={toggleSpectate} />} />
          <GroupRow label="Show Rating on Profile" onPress={toggleElo} right={<ToggleSwitch testID="privacy-elo" label="Toggle show rating" checked={settings.privacyPublicElo} onChange={toggleElo} />} />
        </Group>
      </View>

      <View>
        <SectionLabel>Friend Requests</SectionLabel>
        <Segmented options={POLICIES} value={settings.privacyRequests} onChange={updatePolicy} testIDPrefix="privacy-policy-" />
      </View>

      <View>
        <SectionLabel>Safety & Data</SectionLabel>
        <Group>
          <GroupRow
            testID="privacy-blocked"
            label="Blocked Players"
            value={blockedCount != null ? String(blockedCount) : undefined}
            chevron
            onPress={() => goTab('FriendsTab')}
          />
          <GroupRow testID="delete-account" label="Delete Account & Data" labelColor="#B91C1C" labelWeight="semibold" chevron onPress={() => setDeleting(true)} />
        </Group>
      </View>

      {isGuest ? (
        <ConfirmDialog
          open={deleting}
          title="Delete account?"
          message="This deletes your guest profile and all your progress for good. You can't undo this."
          confirmLabel="Delete"
          destructive
          onCancel={() => setDeleting(false)}
          onConfirm={() => void doDelete()}
        />
      ) : (
        <DeleteAccountModal open={deleting} busy={busy} onClose={() => setDeleting(false)} onDelete={(pw) => void doDelete(pw)} />
      )}
    </Screen>
  );
};
