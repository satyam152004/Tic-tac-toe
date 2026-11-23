import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { BellOff, Check } from 'lucide-react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import { AppModal, ConfirmDialog } from '../../components/common/AppModal';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { Group, GroupRow, SectionLabel } from '../../components/profile/ProtoUi';
import { THEME_LIST } from '../../design-system/themes';
import { type } from '../../design-system/typography';
import { usePreferenceSync } from '../../hooks/usePreferenceSync';
import { useTheme } from '../../hooks/useTheme';
import type { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';
import { authApi } from '../../services/api/authApi';
import { friendlyMessage } from '../../services/api/errors';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { toast } from '../../store/toastStore';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'hi', label: 'हिन्दी' },
] as const;

const ALL_NOTIFS_ON = { social: true, game: true, achievements: true };
const ALL_NOTIFS_OFF = { social: false, game: false, achievements: false };

export const ToggleSwitch: React.FC<{ checked: boolean; onChange: () => void; label: string; testID?: string }> = ({ checked, onChange, label, testID }) => {
  const c = useTheme();
  return (
    <Pressy
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={onChange}
      hitSlop={10}
      scaleTo={1}
      style={{ width: 36, height: 20, borderRadius: 10, padding: 2, justifyContent: 'center', backgroundColor: checked ? c.accent : '#E4E4DF' }}
    >
      <View
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: '#fff',
          transform: [{ translateX: checked ? 16 : 0 }],
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 1,
          shadowOffset: { width: 0, height: 1 },
          elevation: 1,
        }}
      />
    </Pressy>
  );
};

const Row: React.FC<{ icon: React.ReactNode; label: string; right?: React.ReactNode; onPress?: () => void; testID?: string; danger?: boolean }> = ({ icon, label, right, onPress, testID, danger }) => {
  const c = useTheme();
  const body = (
    <>
      {icon}
      <Text style={[type.bodyStrong, { color: danger ? c.dangerText : c.text, flex: 1 }]}>{label}</Text>
      {right}
    </>
  );
  const style = { minHeight: 44, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 };
  return onPress ? (
    <Pressy testID={testID} accessibilityLabel={label} onPress={onPress} style={style}>{body}</Pressy>
  ) : (
    <View style={style}>{body}</View>
  );
};

type Dialog = null | 'logout' | 'logoutAll' | 'password' | 'language';

export const SettingsScreen: React.FC<RootScreenProps<'settings'>> = () => {
  const c = useTheme();
  const { nav, back, resetTo } = useAppNav();
  const settings = useSettingsStore();
  const sync = usePreferenceSync();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const logoutAll = useAuthStore((s) => s.logoutAll);
  const isGuest = user?.accountType === 'GUEST';

  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [permDenied, setPermDenied] = useState(false);

  useEffect(() => {
    let alive = true;
    Notifications.getPermissionsAsync()
      .then((p) => alive && setPermDenied(!p.granted && settings.notifications))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const themeName = (THEME_LIST.find((t) => t.id === settings.theme) ?? THEME_LIST[0]).name;
  const langLabel = SUPPORTED_LANGUAGES.find((l) => l.code === settings.language)?.label ?? settings.language;

  const toggleNotifications = useCallback(async () => {
    if (settings.notifications) {
      setPermDenied(false);
      sync({ notifications: false }, { notificationPrefs: ALL_NOTIFS_OFF });
      return;
    }
    try {
      let perm = await Notifications.getPermissionsAsync();
      if (!perm.granted && perm.canAskAgain) perm = await Notifications.requestPermissionsAsync();
      if (!perm.granted) {
        setPermDenied(true);
        return;
      }
    } catch {
      toast.error('Notifications unavailable', 'Could not check notification permission.');
      return;
    }
    setPermDenied(false);
    sync({ notifications: true }, { notificationPrefs: ALL_NOTIFS_ON });
  }, [settings.notifications, sync]);

  const run = async (fn: () => Promise<void>, done?: () => void) => {
    setBusy(true);
    try {
      await fn();
      setDialog(null);
      done?.();
    } catch (e) {
      toast.error('Something went wrong', friendlyMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleSound = () => sync({ soundEffects: !settings.soundEffects }, { sound: { effects: !settings.soundEffects } });
  const toggleMusic = () => sync({ music: !settings.music }, { sound: { music: !settings.music } });
  const toggleVibration = () => sync({ vibration: !settings.vibration });
  const toggleMoveConfirm = () => settings.set({ moveConfirm: !settings.moveConfirm });

  return (
    <Screen title="Settings" onBack={back} gutter={20} gap={12}>
      <View>
        <SectionLabel>Gameplay</SectionLabel>
        <Group>
          <GroupRow label="Sound Effects" onPress={toggleSound} right={<ToggleSwitch testID="toggle-sound" label="Toggle sound effects" checked={settings.soundEffects} onChange={toggleSound} />} />
          <GroupRow label="Background Music" onPress={toggleMusic} right={<ToggleSwitch testID="toggle-music" label="Toggle background music" checked={settings.music} onChange={toggleMusic} />} />
          <GroupRow label="Haptics" onPress={toggleVibration} right={<ToggleSwitch testID="toggle-vibration" label="Toggle vibration" checked={settings.vibration} onChange={toggleVibration} />} />
          <GroupRow label="Move Confirm" onPress={toggleMoveConfirm} right={<ToggleSwitch testID="toggle-move-confirm" label="Toggle move confirmation" checked={settings.moveConfirm} onChange={toggleMoveConfirm} />} />
        </Group>
      </View>

      <View>
        <SectionLabel>Appearance</SectionLabel>
        <Group>
          <GroupRow testID="row-theme" label="Theme" value={themeName} valueColor={c.accent} chevron onPress={() => nav.navigate('theme_selection')} />
          <GroupRow testID="row-language" label="Language" value={langLabel} chevron onPress={() => setDialog('language')} />
        </Group>
      </View>

      <View>
        <SectionLabel>Notifications</SectionLabel>
        <Group>
          <GroupRow label="Push Notifications" onPress={() => void toggleNotifications()} right={<ToggleSwitch testID="toggle-notifications" label="Toggle notifications" checked={settings.notifications} onChange={() => void toggleNotifications()} />} />
          <GroupRow testID="row-notifications" label="Notification Inbox" chevron onPress={() => nav.navigate('notifications')} />
        </Group>
        {permDenied ? (
          <View testID="notif-denied" style={{ marginTop: 8, borderRadius: 12, borderWidth: 1, borderColor: c.dangerBorder, backgroundColor: c.dangerSoft, padding: 12, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <BellOff size={16} color={c.dangerText} />
              <Text style={[type.smallStrong, { color: c.text, flex: 1 }]}>Notification permission denied</Text>
            </View>
            <Text style={[type.small, { color: c.textSecondary }]}>Allow notifications in your device settings to get friend requests, invites and reward reminders.</Text>
            <AppButton testID="open-os-settings" title="Open settings" size="md" variant="secondary" onPress={() => void Linking.openSettings()} />
          </View>
        ) : null}
      </View>

      <View>
        <SectionLabel>Account</SectionLabel>
        <Group>
          <GroupRow
            label={isGuest ? 'Guest account' : user?.email ?? 'Not signed in'}
            right={!isGuest && user?.email ? <Text testID="verified-status" style={[type.caption, { color: user.emailVerified ? c.success : c.warning }]}>{user.emailVerified ? 'Verified' : 'Not verified'}</Text> : undefined}
          />
          <GroupRow testID="row-privacy" label="Privacy & Safety" chevron onPress={() => nav.navigate('privacy_settings')} />
          {isGuest ? (
            <GroupRow testID="row-upgrade" label="Upgrade account" chevron onPress={() => nav.navigate('registration')} />
          ) : (
            <GroupRow testID="row-change-password" label="Change password" chevron onPress={() => setDialog('password')} />
          )}
          <GroupRow testID="logout" label="Sign Out" labelColor="#B91C1C" labelWeight="semibold" chevron onPress={() => setDialog('logout')} />
          <GroupRow testID="logout-all" label="Sign out from all devices" labelColor="#B91C1C" chevron onPress={() => setDialog('logoutAll')} />
          <GroupRow testID="row-about" label="App version" value={Constants.expoConfig?.version ?? '1.0.0'} />
        </Group>
      </View>

      <ConfirmDialog
        open={dialog === 'logout'}
        title="Log Out?"
        message={isGuest ? 'You are on a guest account. Logging out can lose this guest profile. Upgrade it first to keep your progress.' : 'You can sign back in anytime using your email, Google, or Apple account.'}
        confirmLabel="Log Out"
        destructive
        onCancel={() => setDialog(null)}
        onConfirm={() => void run(logout, () => resetTo('welcome'))}
      />
      <ConfirmDialog
        open={dialog === 'logoutAll'}
        title="Log out everywhere?"
        message="This signs you out of every device, including this one."
        confirmLabel="Log Out All"
        destructive
        onCancel={() => setDialog(null)}
        onConfirm={() => void run(logoutAll, () => resetTo('welcome'))}
      />

      <ChangePasswordModal
        open={dialog === 'password'}
        onClose={() => setDialog(null)}
        onChanged={async () => {
          setDialog(null);
          toast.success('Password changed', 'Please sign in again with your new password.');
          await logout();
          resetTo('welcome');
        }}
      />

      <AppModal open={dialog === 'language'} title="Language" onClose={() => setDialog(null)}>
        <Text style={[type.small, { color: c.textSecondary }]}>
          Your choice is saved to your account. The app interface is currently available in English only; translations are not bundled yet.
        </Text>
        {SUPPORTED_LANGUAGES.map((l) => (
          <Row
            key={l.code}
            testID={`lang-${l.code}`}
            icon={<View style={{ width: 16 }} />}
            label={l.label}
            onPress={() => {
              sync({ language: l.code }, { language: l.code });
              setDialog(null);
              toast.info('Language updated', l.label);
            }}
            right={settings.language === l.code ? <Check size={16} color={c.accent} /> : undefined}
          />
        ))}
      </AppModal>
    </Screen>
  );
};

const ChangePasswordModal: React.FC<{ open: boolean; onClose: () => void; onChanged: () => Promise<void> }> = ({ open, onClose, onChanged }) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) {
      setCurrent('');
      setNext('');
      setConfirm('');
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    if (!current) return setError('Enter your current password.');
    if (next.length < 8) return setError('New password must be at least 8 characters.');
    if (next !== confirm) return setError('Passwords do not match.');
    setError(null);
    setLoading(true);
    try {
      await authApi.changePassword(current, next);
    } catch (e) {
      setError(friendlyMessage(e));
      setLoading(false);
      return;
    }
    setLoading(false);
    await onChanged();
  };

  return (
    <AppModal open={open} title="Change password" onClose={onClose}>
      <AppInput testID="pw-current" label="Current password" value={current} onChangeText={setCurrent} secureToggle autoCapitalize="none" />
      <AppInput testID="pw-new" label="New password" value={next} onChangeText={setNext} secureToggle autoCapitalize="none" hint="At least 8 characters" />
      <AppInput testID="pw-confirm" label="Confirm new password" value={confirm} onChangeText={setConfirm} secureToggle autoCapitalize="none" error={error} />
      <AppButton testID="pw-submit" title="Update password" fullWidth loading={loading} onPress={() => void submit()} />
    </AppModal>
  );
};
