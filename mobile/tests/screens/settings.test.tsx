import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { Linking } from 'react-native';
import { ApiError } from '../../src/services/api/errors';

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_t, k) => (k === '__esModule' ? false : () => null) }));

const mockNav = { nav: { navigate: jest.fn() }, goTab: jest.fn(), goHome: jest.fn(), resetTo: jest.fn(), back: jest.fn() };
jest.mock('../../src/navigation/useAppNav', () => ({ useAppNav: () => mockNav }));
jest.mock('../../src/services/api/userApi', () => ({ userApi: { me: jest.fn(), update: jest.fn() } }));
jest.mock('../../src/services/api/authApi', () => ({ authApi: { changePassword: jest.fn(), requestSetPassword: jest.fn(), logout: jest.fn(), logoutAll: jest.fn() } }));
jest.mock('../../src/services/api/notificationApi', () => ({ notificationApi: { list: jest.fn(), read: jest.fn(), readAll: jest.fn(), remove: jest.fn() } }));
jest.mock('expo-notifications', () => ({ getPermissionsAsync: jest.fn(), requestPermissionsAsync: jest.fn() }));

import * as Notifications from 'expo-notifications';
import { userApi } from '../../src/services/api/userApi';
import { authApi } from '../../src/services/api/authApi';
import { notificationApi } from '../../src/services/api/notificationApi';
import { useAuthStore } from '../../src/store/authStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { useToastStore } from '../../src/store/toastStore';
import { PrivacySettingsScreen } from '../../src/screens/settings/PrivacySettingsScreen';
import { SettingsScreen } from '../../src/screens/settings/SettingsScreen';
import { ThemeSelectionScreen } from '../../src/screens/settings/ThemeSelectionScreen';
import { NotificationsScreen } from '../../src/screens/settings/NotificationsScreen';

const m = (f: unknown) => f as jest.Mock;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const props: any = { navigation: {}, route: { key: 'k', name: 'x' } };

const wrap = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
};

const ME = {
  id: 'u1', username: 'me', displayName: 'Me', email: 'me@example.com', emailVerified: true, avatar: 'av_1', bio: '', timezone: 'UTC',
  wallet: { coins: 0 }, accountType: 'REGISTERED', theme: 'dark', language: 'en',
  sound: { effects: true, music: true, volume: 1 }, notificationPrefs: { social: true, game: true, achievements: true, account: true },
};

const logout = jest.fn(async () => undefined);
const logoutAll = jest.fn(async () => undefined);
const deleteAccount = jest.fn(async (_p?: string) => undefined);

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ status: 'signedIn', user: ME as never, logout, logoutAll, deleteAccount } as never);
  useSettingsStore.setState({ theme: 'dark', soundEffects: true, vibration: true, notifications: true, language: 'en' });
  useToastStore.setState({ toasts: [] } as never);
  m(userApi.update).mockResolvedValue(ME);
  m(Notifications.getPermissionsAsync).mockResolvedValue({ granted: true, canAskAgain: true });
});

describe('SettingsScreen', () => {
  it('persists a toggle locally and PATCHes the account', async () => {
    await wrap(<SettingsScreen {...props} />);
    await fireEvent.press(screen.getByTestId('toggle-sound'));
    expect(useSettingsStore.getState().soundEffects).toBe(false);
    await waitFor(() => expect(userApi.update).toHaveBeenCalledWith({ sound: { effects: false } }));
  });

  it('vibration is a device-only setting (no PATCH)', async () => {
    await wrap(<SettingsScreen {...props} />);
    await fireEvent.press(screen.getByTestId('toggle-vibration'));
    expect(useSettingsStore.getState().vibration).toBe(false);
    expect(userApi.update).not.toHaveBeenCalled();
  });

  it('reverts the toggle and shows a toast when the PATCH fails', async () => {
    m(userApi.update).mockRejectedValue(new ApiError('NETWORK_ERROR', 'x'));
    await wrap(<SettingsScreen {...props} />);
    await fireEvent.press(screen.getByTestId('toggle-sound'));
    await waitFor(() => expect(userApi.update).toHaveBeenCalledWith({ sound: { effects: false } }));
    await waitFor(() => expect(useSettingsStore.getState().soundEffects).toBe(true)); // reverted
    expect(JSON.stringify(useToastStore.getState())).toContain("Couldn't save setting");
  });

  it('turning notifications on requests OS permission then syncs notificationPrefs', async () => {
    useSettingsStore.setState({ notifications: false });
    m(Notifications.getPermissionsAsync).mockResolvedValue({ granted: false, canAskAgain: true });
    m(Notifications.requestPermissionsAsync).mockResolvedValue({ granted: true, canAskAgain: true });
    await wrap(<SettingsScreen {...props} />);
    await fireEvent.press(screen.getByTestId('toggle-notifications'));
    await waitFor(() => expect(useSettingsStore.getState().notifications).toBe(true));
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    await waitFor(() => expect(userApi.update).toHaveBeenCalledWith({ notificationPrefs: { social: true, game: true, achievements: true } }));
  });

  it('shows the permission denied state with an Open settings button', async () => {
    useSettingsStore.setState({ notifications: false });
    m(Notifications.getPermissionsAsync).mockResolvedValue({ granted: false, canAskAgain: false });
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await wrap(<SettingsScreen {...props} />);
    await fireEvent.press(screen.getByTestId('toggle-notifications'));
    expect(await screen.findByTestId('notif-denied')).toBeTruthy();
    expect(useSettingsStore.getState().notifications).toBe(false);
    expect(userApi.update).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('open-os-settings'));
    expect(open).toHaveBeenCalled();
  });

  it('turning notifications off syncs all prefs to false', async () => {
    await wrap(<SettingsScreen {...props} />);
    await fireEvent.press(screen.getByTestId('toggle-notifications'));
    expect(useSettingsStore.getState().notifications).toBe(false);
    await waitFor(() => expect(userApi.update).toHaveBeenCalledWith({ notificationPrefs: { social: false, game: false, achievements: false } }));
  });

  it('language selector stores and PATCHes the language', async () => {
    await wrap(<SettingsScreen {...props} />);
    await fireEvent.press(screen.getByTestId('row-language'));
    await fireEvent.press(await screen.findByTestId('lang-es'));
    expect(useSettingsStore.getState().language).toBe('es');
    await waitFor(() => expect(userApi.update).toHaveBeenCalledWith({ language: 'es' }));
  });

  it('theme row navigates to theme_selection', async () => {
    await wrap(<SettingsScreen {...props} />);
    await fireEvent.press(screen.getByTestId('row-theme'));
    expect(mockNav.nav.navigate).toHaveBeenCalledWith('theme_selection');
  });

  it('logout needs confirmation, then logs out and resets to welcome', async () => {
    await wrap(<SettingsScreen {...props} />);
    await fireEvent.press(screen.getByTestId('logout'));
    expect(logout).not.toHaveBeenCalled();
    expect(await screen.findByText('Sign out?')).toBeTruthy();
    const buttons = screen.getAllByText('Sign Out');
    await fireEvent.press(buttons[buttons.length - 1]);
    await waitFor(() => expect(logout).toHaveBeenCalled());
    await waitFor(() => expect(mockNav.resetTo).toHaveBeenCalledWith('welcome'));
  });

  it('logout from all devices confirms first', async () => {
    await wrap(<SettingsScreen {...props} />);
    await fireEvent.press(screen.getByTestId('logout-all'));
    await fireEvent.press(await screen.findByText('Sign Out All'));
    await waitFor(() => expect(logoutAll).toHaveBeenCalled());
    await waitFor(() => expect(mockNav.resetTo).toHaveBeenCalledWith('welcome'));
  });

  it('delete account asks for the password of registered accounts', async () => {
    await wrap(<PrivacySettingsScreen {...(props as unknown as React.ComponentProps<typeof PrivacySettingsScreen>)} />);
    await fireEvent.press(screen.getByTestId('delete-account'));
    await fireEvent.changeText(await screen.findByTestId('delete-password'), 'Secret123');
    await fireEvent.press(screen.getByTestId('delete-confirm'));
    await waitFor(() => expect(deleteAccount).toHaveBeenCalledWith('Secret123'));
    await waitFor(() => expect(mockNav.resetTo).toHaveBeenCalledWith('welcome'));
  });

  it('change password validates, calls the API, then signs out (server revokes sessions)', async () => {
    m(authApi.changePassword).mockResolvedValue({ message: 'ok' });
    await wrap(<SettingsScreen {...props} />);
    await fireEvent.press(screen.getByTestId('row-change-password'));
    await fireEvent.changeText(await screen.findByTestId('pw-current'), 'OldPass123');
    await fireEvent.changeText(screen.getByTestId('pw-new'), 'short');
    await fireEvent.press(screen.getByTestId('pw-submit'));
    expect(await screen.findByText('New password must be at least 8 characters.')).toBeTruthy();
    expect(authApi.changePassword).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId('pw-new'), 'BrandNew123');
    await fireEvent.changeText(screen.getByTestId('pw-confirm'), 'BrandNew123');
    await fireEvent.press(screen.getByTestId('pw-submit'));
    await waitFor(() => expect(authApi.changePassword).toHaveBeenCalledWith('OldPass123', 'BrandNew123'));
    await waitFor(() => expect(logout).toHaveBeenCalled());
    expect(mockNav.resetTo).toHaveBeenCalledWith('welcome');
  });

  it('Google accounts without a password see "Set a password", not "Change password"', async () => {
    useAuthStore.setState({ user: { ...ME, hasPassword: false } as never });
    await wrap(<SettingsScreen {...props} />);
    expect(screen.queryByTestId('row-change-password')).toBeNull();
    expect(screen.getByTestId('row-set-password')).toBeTruthy();
  });

  it('accounts with a password keep "Change password"', async () => {
    useAuthStore.setState({ user: { ...ME, hasPassword: true } as never });
    await wrap(<SettingsScreen {...props} />);
    expect(screen.queryByTestId('row-set-password')).toBeNull();
    expect(screen.getByTestId('row-change-password')).toBeTruthy();
  });

  it('set a password: emails a code, validates, then stores the password without signing out', async () => {
    const setPassword = jest.fn(async (_c: string, _p: string) => ME as never);
    useAuthStore.setState({ user: { ...ME, hasPassword: false } as never, setPassword } as never);
    m(authApi.requestSetPassword).mockResolvedValue({ sent: true, retryAfterSec: 60 });
    await wrap(<SettingsScreen {...props} />);
    await fireEvent.press(screen.getByTestId('row-set-password'));
    await fireEvent.press(await screen.findByTestId('setpw-send'));
    await waitFor(() => expect(authApi.requestSetPassword).toHaveBeenCalledTimes(1));

    await fireEvent.changeText(await screen.findByTestId('setpw-code'), '12');
    await fireEvent.press(screen.getByTestId('setpw-submit'));
    expect(await screen.findByText('Enter the 6-digit code from the email.')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('setpw-code'), '123456');
    await fireEvent.changeText(screen.getByTestId('setpw-new'), 'short');
    await fireEvent.press(screen.getByTestId('setpw-submit'));
    expect(await screen.findByText('Use at least 8 characters with a letter and a number.')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('setpw-new'), 'BrandNew123');
    await fireEvent.changeText(screen.getByTestId('setpw-confirm'), 'Different123');
    await fireEvent.press(screen.getByTestId('setpw-submit'));
    expect(await screen.findByText('Passwords do not match.')).toBeTruthy();
    expect(setPassword).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('setpw-confirm'), 'BrandNew123');
    await fireEvent.press(screen.getByTestId('setpw-submit'));
    await waitFor(() => expect(setPassword).toHaveBeenCalledWith('123456', 'BrandNew123'));
    // the server returns a fresh session: nothing to sign out of
    expect(logout).not.toHaveBeenCalled();
    expect(mockNav.resetTo).not.toHaveBeenCalled();
  });

  it('shows the server error when the code request fails (e.g. cooldown)', async () => {
    useAuthStore.setState({ user: { ...ME, hasPassword: false } as never });
    m(authApi.requestSetPassword).mockRejectedValue(new ApiError('OTP_COOLDOWN', 'Please wait before requesting another code'));
    await wrap(<SettingsScreen {...props} />);
    await fireEvent.press(screen.getByTestId('row-set-password'));
    await fireEvent.press(await screen.findByTestId('setpw-send'));
    expect(await screen.findByTestId('setpw-error')).toBeTruthy();
    expect(screen.queryByTestId('setpw-code')).toBeNull();
  });

  it('guests see an upgrade prompt instead of change password', async () => {
    useAuthStore.setState({ user: { ...ME, accountType: 'GUEST', email: null } as never });
    await wrap(<SettingsScreen {...props} />);
    expect(screen.queryByTestId('row-change-password')).toBeNull();
    await fireEvent.press(screen.getByTestId('row-upgrade'));
    expect(mockNav.nav.navigate).toHaveBeenCalledWith('registration');
  });
});

describe('ThemeSelectionScreen', () => {
  it('lists the three kit themes', async () => {
    await wrap(<ThemeSelectionScreen {...props} />);
    for (const id of ['dark', 'light', 'classic']) expect(screen.getByTestId(`theme-${id}`)).toBeTruthy();
  });

  it('applies the theme immediately and PATCHes users/me in the background', async () => {
    await wrap(<ThemeSelectionScreen {...props} />);
    await fireEvent.press(screen.getByTestId('theme-classic'));
    expect(useSettingsStore.getState().theme).toBe('classic');
    await waitFor(() => expect(userApi.update).toHaveBeenCalledWith({ theme: 'classic' }));
  });

  it('keeps the theme locally when the sync fails (offline) and warns', async () => {
    m(userApi.update).mockRejectedValue(new ApiError('NETWORK_ERROR', 'x'));
    await wrap(<ThemeSelectionScreen {...props} />);
    await fireEvent.press(screen.getByTestId('theme-classic'));
    expect(useSettingsStore.getState().theme).toBe('classic');
    await waitFor(() => expect(JSON.stringify(useToastStore.getState())).toContain('Theme saved on this device only'));
    expect(useSettingsStore.getState().theme).toBe('classic');
  });
});

describe('NotificationsScreen', () => {
  const n = (id: string, type: string, data: Record<string, string> = {}, readAt: string | null = null) => ({
    id, type, category: 'x', title: `Title ${id}`, body: `Body ${id}`, data, readAt, createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
  });
  const load = (items: ReturnType<typeof n>[]) => m(notificationApi.list).mockResolvedValue({ items, unread: items.filter((i) => !i.readAt).length, total: items.length });

  beforeEach(() => {
    m(notificationApi.read).mockResolvedValue({});
    m(notificationApi.readAll).mockResolvedValue({ updated: 1 });
    m(notificationApi.remove).mockResolvedValue({ deleted: true });
  });

  it.each([
    ['FRIEND_REQUEST', {}, 'goTab', ['FriendsTab']],
    ['FRIEND_ACCEPTED', {}, 'goTab', ['FriendsTab']],
    ['GAME_INVITE', { gameId: 'g1', roomCode: 'ABC123' }, 'navigate', ['match_invitation', { gameId: 'g1', roomCode: 'ABC123', fromName: undefined }]],
    ['REMATCH_REQUEST', { gameId: 'g2' }, 'navigate', ['online_board', { gameId: 'g2' }]],
    ['MATCH_FOUND', { gameId: 'g3' }, 'navigate', ['match_found', { gameId: 'g3', source: 'RANKED' }]],
    ['ACHIEVEMENT_UNLOCKED', {}, 'navigate', ['achievements']],
    ['LEVEL_UP', {}, 'goTab', ['ProfileTab']],
  ])('routes %s on tap and marks it read', async (type, data, fn, args) => {
    load([n('n1', type, data as Record<string, string>)]);
    await wrap(<NotificationsScreen {...props} />);
    await fireEvent.press(await screen.findByTestId('notification-open-n1'));
    expect(notificationApi.read).toHaveBeenCalledWith('n1');
    const target = fn === 'goTab' ? mockNav.goTab : mockNav.nav.navigate;
    expect(target).toHaveBeenCalledWith(...(args as unknown[]));
  });

  it('renders title/body/time and mark-all-read clears the unread count', async () => {
    load([n('a', 'LEVEL_UP'), n('b', 'FRIEND_REQUEST')]);
    await wrap(<NotificationsScreen {...props} />);
    expect(await screen.findByText('Title a')).toBeTruthy();
    expect(screen.getAllByText(/5m ago/)).toHaveLength(2);
    expect(screen.getByText('UNREAD')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('mark-all-read'));
    await waitFor(() => expect(notificationApi.readAll).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('UNREAD')).toBeNull());
    expect(screen.getByText('EARLIER')).toBeTruthy();
  });

  it('deletes a notification via the row action', async () => {
    load([n('a', 'LEVEL_UP')]);
    await wrap(<NotificationsScreen {...props} />);
    await fireEvent.press(await screen.findByTestId('notification-delete-a'));
    await waitFor(() => expect(notificationApi.remove).toHaveBeenCalledWith('a'));
    expect(await screen.findByText('No notifications')).toBeTruthy();
  });

  it('shows the empty and offline states', async () => {
    load([]);
    const first = await wrap(<NotificationsScreen {...props} />);
    expect(await screen.findByText('No notifications')).toBeTruthy();
    first.unmount();
    m(notificationApi.list).mockRejectedValue(new ApiError('NETWORK_ERROR', 'x'));
    await wrap(<NotificationsScreen {...props} />);
    expect(await screen.findByText("You're offline")).toBeTruthy();
  });
});
