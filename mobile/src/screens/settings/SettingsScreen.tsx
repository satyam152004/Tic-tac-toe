import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Bell, BellOff, Check, ChevronRight, Globe, Info, KeyRound, LogOut, Mail, Music, Palette, Smartphone, Trash2, UserPlus, Volume2 } from 'lucide-react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppInput } from '../../components/common/AppInput';
import { AppModal, ConfirmDialog } from '../../components/common/AppModal';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { THEME_LIST } from '../../design-system/themes';
import { fonts, type } from '../../design-system/typography';
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
      hitSlop={8}
      style={{ width: 48, height: 28, borderRadius: 14, padding: 4, justifyContent: 'center', backgroundColor: checked ? c.accent : c.bgSecondary, borderWidth: checked ? 0 : 1, borderColor: c.border }}
    >
      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', transform: [{ translateX: checked ? 20 : 0 }] }} />
    </Pressy>
  );
};

const Row: React.FC<{ icon: React.ReactNode; label: string; right?: React.ReactNode; onPress?: () => void; testID?: string; danger?: boolean }> = ({ icon, label, right, onPress, testID, danger }) => {
  const c = useTheme();
  const body = (
    <>
      {icon}
      <Text style={[type.bodyStrong, { color: danger ? '#F87171' : c.text, flex: 1 }]}>{label}</Text>
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

const SectionTitle: React.FC<{ children: string }> = ({ children }) => {
  const c = useTheme();
  return <Text style={[type.smallStrong, { color: c.textSecondary }]}>{children}</Text>;
};

type Dialog = null | 'logout' | 'logoutAll' | 'delete' | 'password' | 'language';

export const SettingsScreen: React.FC<RootScreenProps<'settings'>> = () => {
  const c = useTheme();
  const { nav, back, resetTo } = useAppNav();
  const settings = useSettingsStore();
  const sync = usePreferenceSync();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const logoutAll = useAuthStore((s) => s.logoutAll);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const isGuest = user?.accountType === 'GUEST';

  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [permDenied, setPermDenied] = useState(false);

  // Keep the "permission denied" banner honest when the user changes it in the OS settings and comes back.
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

  return (
    <Screen title="Settings" onBack={back}>
      <AppCard style={{ gap: 14 }}>
        <SectionTitle>Audio & Haptics</SectionTitle>
        <Row icon={<Volume2 size={16} color={c.accent} />} label="Sound Effects" right={<ToggleSwitch testID="toggle-sound" label="Toggle sound effects" checked={settings.soundEffects} onChange={() => sync({ soundEffects: !settings.soundEffects }, { sound: { effects: !settings.soundEffects } })} />} />
        <Row icon={<Music size={16} color={c.accentSecondary} />} label="Background Music" right={<ToggleSwitch testID="toggle-music" label="Toggle background music" checked={settings.music} onChange={() => sync({ music: !settings.music }, { sound: { music: !settings.music } })} />} />
        <Row icon={<Smartphone size={16} color={c.o} />} label="Vibration" right={<ToggleSwitch testID="toggle-vibration" label="Toggle vibration" checked={settings.vibration} onChange={() => sync({ vibration: !settings.vibration })} />} />
      </AppCard>

      <AppCard style={{ gap: 14 }}>
        <SectionTitle>Preferences</SectionTitle>
        <Row
          testID="row-theme"
          icon={<Palette size={16} color={c.accent} />}
          label="Board Theme"
          onPress={() => nav.navigate('theme_selection')}
          right={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={[type.small, { color: c.textSecondary }]}>{themeName}</Text>
              <ChevronRight size={16} color={c.textSecondary} />
            </View>
          }
        />
        <Row icon={<Bell size={16} color={c.warning} />} label="Notifications" right={<ToggleSwitch testID="toggle-notifications" label="Toggle notifications" checked={settings.notifications} onChange={() => void toggleNotifications()} />} />
        {permDenied ? (
          <View testID="notif-denied" style={{ borderRadius: 12, borderWidth: 1, borderColor: c.danger + '66', backgroundColor: c.danger + '1A', padding: 12, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <BellOff size={16} color="#F87171" />
              <Text style={[type.smallStrong, { color: c.text, flex: 1 }]}>Notification permission denied</Text>
            </View>
            <Text style={[type.small, { color: c.textSecondary }]}>Allow notifications in your device settings to get friend requests, invites and reward reminders.</Text>
            <AppButton testID="open-os-settings" title="Open settings" size="md" variant="secondary" onPress={() => void Linking.openSettings()} />
          </View>
        ) : null}
        <Row
          testID="row-language"
          icon={<Globe size={16} color={c.success} />}
          label="Language"
          onPress={() => setDialog('language')}
          right={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={[type.small, { color: c.textSecondary }]}>{langLabel}</Text>
              <ChevronRight size={16} color={c.textSecondary} />
            </View>
          }
        />
      </AppCard>

      <AppCard style={{ gap: 14 }}>
        <SectionTitle>Account</SectionTitle>
        <Row
          icon={<Mail size={16} color={c.textSecondary} />}
          label={isGuest ? 'Guest account' : user?.email ?? 'Not signed in'}
          right={!isGuest && user?.email ? <Text testID="verified-status" style={[type.smallStrong, { color: user.emailVerified ? c.success : c.warning }]}>{user.emailVerified ? 'Verified' : 'Not verified'}</Text> : undefined}
        />
        {isGuest ? (
          <Row testID="row-upgrade" icon={<UserPlus size={16} color={c.accent} />} label="Upgrade account" onPress={() => nav.navigate('registration')} right={<ChevronRight size={16} color={c.textSecondary} />} />
        ) : (
          <Row testID="row-change-password" icon={<KeyRound size={16} color={c.textSecondary} />} label="Change password" onPress={() => setDialog('password')} right={<ChevronRight size={16} color={c.textSecondary} />} />
        )}
        <Row testID="row-about" icon={<Info size={16} color={c.textSecondary} />} label="App version" right={<Text style={[type.small, { color: c.textSecondary, fontFamily: fonts.mono.medium }]}>{Constants.expoConfig?.version ?? '1.0.0'}</Text>} />
      </AppCard>

      <AppButton testID="logout" fullWidth variant="danger" title="Log Out" icon={<LogOut size={16} color="#fff" />} onPress={() => setDialog('logout')} />
      <AppButton testID="logout-all" fullWidth variant="outline" title="Log out from all devices" onPress={() => setDialog('logoutAll')} />
      <AppButton testID="delete-account" fullWidth variant="ghost" title="Delete account" icon={<Trash2 size={16} color="#F87171" />} onPress={() => setDialog('delete')} />

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

      {isGuest ? (
        <ConfirmDialog
          open={dialog === 'delete'}
          title="Delete account?"
          message="This permanently deletes your guest profile and all of its progress. This cannot be undone."
          confirmLabel="Delete"
          destructive
          onCancel={() => setDialog(null)}
          onConfirm={() => void run(() => deleteAccount(), () => resetTo('welcome'))}
        />
      ) : (
        <DeleteAccountModal open={dialog === 'delete'} busy={busy} onClose={() => setDialog(null)} onDelete={(pw) => void run(() => deleteAccount(pw), () => resetTo('welcome'))} />
      )}

      <ChangePasswordModal
        open={dialog === 'password'}
        onClose={() => setDialog(null)}
        onChanged={async () => {
          // The server revokes every session on a password change, so sign in again with the new password.
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

const DeleteAccountModal: React.FC<{ open: boolean; busy: boolean; onClose: () => void; onDelete: (password: string) => void }> = ({ open, busy, onClose, onDelete }) => {
  const c = useTheme();
  const [pw, setPw] = useState('');
  useEffect(() => {
    if (!open) setPw('');
  }, [open]);
  return (
    <AppModal open={open} title="Delete account?" onClose={onClose}>
      <Text style={[type.body, { color: c.textSecondary }]}>This permanently deletes your account, stats and friends. Enter your password to confirm.</Text>
      <AppInput testID="delete-password" label="Password" value={pw} onChangeText={setPw} secureToggle autoCapitalize="none" autoCorrect={false} />
      <AppButton testID="delete-confirm" title="Delete forever" variant="danger" fullWidth loading={busy} disabled={pw.length === 0} onPress={() => onDelete(pw)} />
    </AppModal>
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
