import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';
import { ApiError } from '../../src/services/api/errors';
import type { Me } from '../../src/services/api/types';
import { useAuthStore } from '../../src/store/authStore';

// lucide-react-native ships ESM only; icons are irrelevant here so every icon becomes an empty component.
jest.mock('lucide-react-native', () => new Proxy({ __esModule: true }, { get: (t, k) => (k in t ? (t as never)[k] : () => null) }));

const mockNav ={ navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn(), canGoBack: () => true, dispatch: jest.fn() };
const mockResetTo = jest.fn();
const mockBack = jest.fn();
const mockAllow = jest.fn();
jest.mock('../../src/navigation/useAppNav', () => ({
  useAppNav: () => ({ nav: mockNav, goTab: jest.fn(), goHome: jest.fn(), resetTo: mockResetTo, back: mockBack }),
}));
jest.mock('../../src/hooks/useBackGuard', () => ({ useBackGuard: jest.fn(() => ({ allow: mockAllow, reset: jest.fn() })) }));
jest.mock('../../src/services/socialAuth', () => ({
  socialProviders: { google: true, apple: false },
  signInWithGoogle: jest.fn(async () => undefined),
  signInWithApple: jest.fn(async () => undefined),
}));
jest.mock('../../src/services/api/authApi', () => ({
  authApi: {
    verifyEmail: jest.fn(),
    resendVerification: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
  },
}));
jest.mock('../../src/services/api/userApi', () => ({ userApi: { me: jest.fn(), update: jest.fn() } }));
jest.mock('../../src/services/api/statisticsApi', () => ({
  statisticsApi: { me: jest.fn(), streaks: jest.fn(async () => ({ currentStreak: 3, bestStreak: 7, recentForm: ['WIN', 'LOSS', 'DRAW'] })), history: jest.fn() },
}));

import { authApi } from '../../src/services/api/authApi';
import { userApi } from '../../src/services/api/userApi';
import { signInWithGoogle } from '../../src/services/socialAuth';
import { ForgotPasswordScreen } from '../../src/screens/auth/ForgotPasswordScreen';
import { LoginScreen } from '../../src/screens/auth/LoginScreen';
import { OtpVerificationScreen } from '../../src/screens/auth/OtpVerificationScreen';
import { RegistrationScreen } from '../../src/screens/auth/RegistrationScreen';
import { EditProfileScreen } from '../../src/screens/profile/EditProfileScreen';
import { UserProfileScreen } from '../../src/screens/profile/UserProfileScreen';

const api = authApi as jest.Mocked<typeof authApi>;
const users = userApi as jest.Mocked<typeof userApi>;

const makeMe = (patch: Partial<Me> = {}): Me => ({
  id: 'u1', username: 'aiden', displayName: 'Aiden Vance', email: 'aiden@example.com', emailVerified: false,
  avatar: 'avatar_2', bio: 'Hello', timezone: 'UTC', wallet: { coins: 420 }, accountType: 'REGISTERED', theme: 'dark', language: 'en',
  sound: { effects: true, music: true, volume: 1 }, notificationPrefs: { social: true, game: true, achievements: true, account: true },
  online: true, lastActiveAt: '', createdAt: '',
  stats: {
    totalGames: 20, wins: 12, losses: 6, draws: 2, winPercentage: 60, points: 1337, xp: 150, level: 4, xpForCurrentLevel: 100, xpForNextLevel: 200,
    currentStreak: 3, bestStreak: 7, totalPlayTimeSec: 0, averageGameDurationSec: 0, aiGames: 0, aiWins: 0, onlineGames: 0, onlineWins: 0,
    local: { games: 0, wins: 0, losses: 0, draws: 0 },
  },
  ...patch,
});

const route = <T,>(params?: T) => ({ key: 'k', name: 'x', params }) as never;
const props = (params?: object) => ({ navigation: mockNav as never, route: route(params) });

const withClient = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
};

const type = (id: string, text: string) => fireEvent.changeText(screen.getByTestId(id), text);
const press = (id: string) => fireEvent.press(screen.getByTestId(id));

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ status: 'signedOut', user: null });
});

describe('LoginScreen', () => {
  const signIn = jest.fn();
  beforeEach(() => useAuthStore.setState({ signIn }));

  it('validates email and password before calling the store', async () => {
    await render(<LoginScreen {...(props() as any)} />);
    await press('login-submit');
    expect(await screen.findByText('Enter your email address')).toBeTruthy();
    expect(screen.getByText('Enter your password')).toBeTruthy();
    await type('login-email', 'nope');
    await type('login-password', 'x');
    await press('login-submit');
    expect(await screen.findByText('Enter a valid email address')).toBeTruthy();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('signs in and resets to Main', async () => {
    signIn.mockResolvedValue(makeMe());
    await render(<LoginScreen {...(props() as any)} />);
    await type('login-email', ' Aiden@Example.com ');
    await type('login-password', 'Passw0rd1');
    await press('login-submit');
    await waitFor(() => expect(mockResetTo).toHaveBeenCalledWith('Main'));
    expect(signIn).toHaveBeenCalledWith('aiden@example.com', 'Passw0rd1');
  });

  it('shows INVALID_CREDENTIALS inline and does not navigate', async () => {
    signIn.mockRejectedValue(new ApiError('INVALID_CREDENTIALS', 'bad', 401));
    await render(<LoginScreen {...(props() as any)} />);
    await type('login-email', 'a@b.co');
    await type('login-password', 'wrongpass1');
    await press('login-submit');
    expect(await screen.findByText('Wrong email or password.')).toBeTruthy();
    expect(mockResetTo).not.toHaveBeenCalled();
  });

  it('navigates to forgot password / registration and runs Google sign-in; Apple hidden', async () => {
    await render(<LoginScreen {...(props() as any)} />);
    await press('login-forgot');
    expect(mockNav.navigate).toHaveBeenCalledWith('forgot_password');
    await press('login-signup');
    expect(mockNav.navigate).toHaveBeenCalledWith('registration');
    expect(screen.queryByTestId('login-apple')).toBeNull();
    await press('login-google');
    await waitFor(() => expect(mockResetTo).toHaveBeenCalledWith('Main'));
    expect(signInWithGoogle).toHaveBeenCalled();
  });

  it('ignores a cancelled social sign-in silently', async () => {
    (signInWithGoogle as jest.Mock).mockRejectedValueOnce(new Error('CANCELLED'));
    await render(<LoginScreen {...(props() as any)} />);
    await press('login-google');
    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalled());
    expect(screen.queryByTestId('login-error')).toBeNull();
    expect(mockResetTo).not.toHaveBeenCalled();
  });
});

describe('RegistrationScreen', () => {
  const register = jest.fn();
  const upgradeGuest = jest.fn();
  beforeEach(() => useAuthStore.setState({ register, upgradeGuest }));

  const fill = async (over: Partial<Record<'user' | 'email' | 'pass', string>> = {}) => {
    await type('register-username', over.user ?? 'tactical_alex');
    await type('register-email', over.email ?? 'alex@example.com');
    await type('register-password', over.pass ?? 'Passw0rd1');
  };

  it('shows live password rules and validates fields', async () => {
    await render(<RegistrationScreen {...(props() as any)} />);
    expect(screen.getByLabelText('1 number: not met')).toBeTruthy();
    await type('register-password', 'abcdefgh1');
    expect(screen.getByLabelText('1 number: met')).toBeTruthy();
    await press('register-submit');
    expect(await screen.findByText('Username must be at least 3 characters')).toBeTruthy();
    expect(screen.getByText('Enter your email address')).toBeTruthy();
    expect(register).not.toHaveBeenCalled();
  });

  it('rejects a weak password and bad username characters', async () => {
    await render(<RegistrationScreen {...(props() as any)} />);
    await fill({ user: 'bad name!', pass: 'short' });
    await press('register-submit');
    expect(await screen.findByText('Only letters, numbers and underscores')).toBeTruthy();
    expect(screen.getByText('Password does not meet the requirements below')).toBeTruthy();
  });

  it('registers and goes to OTP verification', async () => {
    register.mockResolvedValue(makeMe());
    await render(<RegistrationScreen {...(props() as any)} />);
    await fill();
    await press('register-submit');
    await waitFor(() => expect(mockNav.replace).toHaveBeenCalledWith('otp_verification', { email: 'alex@example.com', purpose: 'verify' }));
    expect(register).toHaveBeenCalledWith({ email: 'alex@example.com', password: 'Passw0rd1', username: 'tactical_alex' });
    expect(upgradeGuest).not.toHaveBeenCalled();
  });

  it('maps EMAIL_TAKEN and USERNAME_TAKEN to the right field', async () => {
    register.mockRejectedValueOnce(new ApiError('EMAIL_TAKEN', 'x', 409)).mockRejectedValueOnce(new ApiError('USERNAME_TAKEN', 'x', 409));
    await render(<RegistrationScreen {...(props() as any)} />);
    await fill();
    await press('register-submit');
    expect(await screen.findByText(/email is already registered/)).toBeTruthy();
    await press('register-submit');
    expect(await screen.findByText(/username is taken/)).toBeTruthy();
    expect(mockNav.replace).not.toHaveBeenCalled();
  });

  it('a guest tapping Google upgrades the guest account instead of switching accounts', async () => {
    useAuthStore.setState({ status: 'signedIn', user: makeMe({ accountType: 'GUEST', email: null }) });
    await render(<RegistrationScreen {...(props() as any)} />);
    await press('register-google');
    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalledWith({ upgradeGuest: true }));
  });

  it('a signed-out user tapping Google signs in normally', async () => {
    useAuthStore.setState({ status: 'signedOut', user: null });
    await render(<RegistrationScreen {...(props() as any)} />);
    await press('register-google');
    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalledWith({ upgradeGuest: false }));
  });

  it('upgrades a guest instead of registering (keeps progress)', async () => {
    useAuthStore.setState({ status: 'signedIn', user: makeMe({ accountType: 'GUEST', email: null }) });
    upgradeGuest.mockResolvedValue(makeMe());
    await render(<RegistrationScreen {...(props() as any)} />);
    await fill();
    await press('register-submit');
    await waitFor(() => expect(upgradeGuest).toHaveBeenCalledWith({ email: 'alex@example.com', password: 'Passw0rd1', username: 'tactical_alex' }));
    expect(register).not.toHaveBeenCalled();
    expect(mockNav.replace).toHaveBeenCalledWith('otp_verification', { email: 'alex@example.com', purpose: 'verify' });
  });
});

describe('OtpVerificationScreen', () => {
  const refreshUser = jest.fn(async () => null);
  beforeEach(() => {
    jest.useFakeTimers();
    useAuthStore.setState({ status: 'signedIn', user: makeMe(), refreshUser });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const renderOtp = () => render(<OtpVerificationScreen {...(props({ email: 'a@b.co', purpose: 'verify' }) as any)} />);

  it('pasting a full code fills the boxes and verifies automatically', async () => {
    api.verifyEmail.mockResolvedValue({ verified: true });
    await renderOtp();
    await fireEvent.changeText(screen.getByTestId('otp-0'), '482 910');
    await waitFor(() => expect(api.verifyEmail).toHaveBeenCalledWith('a@b.co', '482910'));
    await waitFor(() => expect(mockResetTo).toHaveBeenCalledWith('Main'));
    expect(refreshUser).toHaveBeenCalled();
  });

  it('typing digits one by one fills boxes and submits at six', async () => {
    api.verifyEmail.mockResolvedValue({ verified: true });
    await renderOtp();
    for (let i = 0; i < 6; i++) await fireEvent.changeText(screen.getByTestId(`otp-${i}`), String(i + 1));
    expect(screen.getByTestId('otp-5').props.value).toBe('6');
    await waitFor(() => expect(api.verifyEmail).toHaveBeenCalledWith('a@b.co', '123456'));
  });

  it('exposes one-time-code autofill hints', async () => {
    await renderOtp();
    expect(screen.getByTestId('otp-0').props.autoComplete).toBe('one-time-code');
    expect(screen.getByTestId('otp-0').props.textContentType).toBe('oneTimeCode');
  });

  it('wrong code shows attempts left and clears the boxes', async () => {
    api.verifyEmail.mockRejectedValue(new ApiError('INVALID_OTP', 'x', 400, { attemptsLeft: 3 }));
    await renderOtp();
    await fireEvent.changeText(screen.getByTestId('otp-0'), '111111');
    expect(await screen.findByText('Wrong code. 3 attempts left.')).toBeTruthy();
    expect(screen.getByTestId('otp-0').props.value).toBe('');
    expect(mockResetTo).not.toHaveBeenCalled();
  });

  it('OTP_LOCKED disables the inputs and prompts for a new code', async () => {
    api.verifyEmail.mockRejectedValue(new ApiError('OTP_LOCKED', 'x', 429));
    await renderOtp();
    await fireEvent.changeText(screen.getByTestId('otp-0'), '222222');
    expect(await screen.findByText(/Too many wrong attempts/)).toBeTruthy();
    expect(screen.getByTestId('otp-0').props.editable).toBe(false);
  });

  it('resend is gated by the 60s countdown, then re-sends and restarts it', async () => {
    api.resendVerification.mockResolvedValue({ sent: true, retryAfterSec: 60 });
    await renderOtp();
    expect(screen.getByTestId('otp-countdown')).toBeTruthy();
    expect(screen.queryByTestId('otp-resend')).toBeNull();
    for (let i = 0; i < 60; i++) await act(async () => void jest.advanceTimersByTime(1000));
    await press('otp-resend');
    await waitFor(() => expect(api.resendVerification).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId('otp-countdown')).toBeTruthy();
  });

  it('uses the server cooldown when resend is too early', async () => {
    api.resendVerification.mockRejectedValue(new ApiError('OTP_COOLDOWN', 'x', 429, { retryAfterSec: 20 }));
    await renderOtp();
    for (let i = 0; i < 60; i++) await act(async () => void jest.advanceTimersByTime(1000));
    await press('otp-resend');
    expect(await screen.findByText('Resend in')).toBeTruthy();
    expect(screen.getByTestId('otp-countdown').props.children).toMatch(/^00:(19|20)$/);
  });

  it('reset purpose redirects to forgot_password', async () => {
    await render(<OtpVerificationScreen {...(props({ email: 'a@b.co', purpose: 'reset' }) as any)} />);
    expect(mockNav.replace).toHaveBeenCalledWith('forgot_password');
  });
});

describe('ForgotPasswordScreen', () => {
  it('step 1 validates email, requests a code, shows a neutral message', async () => {
    api.forgotPassword.mockResolvedValue({ message: 'ok' });
    await render(<ForgotPasswordScreen {...(props() as any)} />);
    await press('forgot-send');
    expect(await screen.findByText('Enter your email address')).toBeTruthy();
    await type('forgot-email', 'me@example.com');
    await press('forgot-send');
    await waitFor(() => expect(api.forgotPassword).toHaveBeenCalledWith('me@example.com'));
    expect(await screen.findByTestId('forgot-neutral')).toBeTruthy();
  });

  it('step 2 resets the password with code and returns to login', async () => {
    api.forgotPassword.mockResolvedValue({ message: 'ok' });
    api.resetPassword.mockResolvedValue({ message: 'ok' });
    await render(<ForgotPasswordScreen {...(props() as any)} />);
    await type('forgot-email', 'me@example.com');
    await press('forgot-send');
    await screen.findByTestId('reset-otp-0');
    await fireEvent.changeText(screen.getByTestId('reset-otp-0'), '654321');
    await type('reset-password', 'N3wPassword');
    await press('reset-submit');
    await waitFor(() => expect(api.resetPassword).toHaveBeenCalledWith({ email: 'me@example.com', code: '654321', newPassword: 'N3wPassword' }));
    expect(mockResetTo).toHaveBeenCalledWith('login');
  });

  it('step 2 validates, maps INVALID_OTP attempts and OTP_LOCKED', async () => {
    api.forgotPassword.mockResolvedValue({ message: 'ok' });
    api.resetPassword.mockRejectedValueOnce(new ApiError('INVALID_OTP', 'x', 400, { attemptsLeft: 2 })).mockRejectedValueOnce(new ApiError('OTP_LOCKED', 'x', 429));
    await render(<ForgotPasswordScreen {...(props() as any)} />);
    await type('forgot-email', 'me@example.com');
    await press('forgot-send');
    await screen.findByTestId('reset-otp-0');
    await press('reset-submit');
    expect(await screen.findByText('Enter the 6-digit code from your email')).toBeTruthy();
    expect(screen.getByText('Password does not meet the requirements below')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('reset-otp-0'), '000000');
    await type('reset-password', 'N3wPassword');
    await press('reset-submit');
    expect(await screen.findByText('Wrong code. 2 attempts left.')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('reset-otp-0'), '111111');
    await press('reset-submit');
    expect(await screen.findByText(/Too many wrong attempts/)).toBeTruthy();
    expect(screen.getByTestId('reset-otp-0').props.editable).toBe(false);
    expect(mockResetTo).not.toHaveBeenCalled();
  });
});

describe('EditProfileScreen', () => {
  beforeEach(() => useAuthStore.setState({ status: 'signedIn', user: makeMe() }));

  it('disables save until something changes and sends only changed fields', async () => {
    users.update.mockResolvedValue(makeMe({ bio: 'New bio' }));
    await render(withClient(<EditProfileScreen {...(props() as any)} />));
    expect(screen.getByTestId('profile-save').props.accessibilityState?.disabled).toBe(true);
    await type('edit-bio', 'New bio');
    expect(screen.getByTestId('bio-counter').props.children.join('')).toBe('7/160');
    await press('profile-save');
    await waitFor(() => expect(users.update).toHaveBeenCalledWith({ bio: 'New bio' }));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(mockAllow).toHaveBeenCalled();
  });

  it('maps the avatar preset to the server id format', async () => {
    users.update.mockResolvedValue(makeMe());
    await render(withClient(<EditProfileScreen {...(props() as any)} />));
    await press('avatar-av_4');
    await press('profile-save');
    await waitFor(() => expect(users.update).toHaveBeenCalledWith({ avatar: 'avatar_4' }));
  });

  it('shows USERNAME_TAKEN on the username field', async () => {
    users.update.mockRejectedValue(new ApiError('USERNAME_TAKEN', 'x', 409));
    await render(withClient(<EditProfileScreen {...(props() as any)} />));
    await type('edit-username', 'taken_name');
    await press('profile-save');
    expect(await screen.findByText(/username is taken/)).toBeTruthy();
    expect(users.update).toHaveBeenCalledWith({ username: 'taken_name' });
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('blocks invalid values (bad username, over-long bio)', async () => {
    await render(withClient(<EditProfileScreen {...(props() as any)} />));
    await type('edit-username', 'a!');
    expect(await screen.findByText('Username must be at least 3 characters')).toBeTruthy();
    expect(screen.getByTestId('profile-save').props.accessibilityState?.disabled).toBe(true);
    await type('edit-username', 'aiden');
    await type('edit-bio', 'x'.repeat(161));
    expect(await screen.findByText('Bio can be at most 160 characters')).toBeTruthy();
  });
});

describe('UserProfileScreen', () => {
  it('renders identity, elo, played / win % / streak stats', async () => {
    useAuthStore.setState({ status: 'signedIn', user: makeMe() });
    await render(withClient(<UserProfileScreen />));
    expect(screen.getByText('Aiden Vance')).toBeTruthy();
    expect(screen.getByText('@aiden • 1,337 ELO')).toBeTruthy();
    expect(screen.getByText('20')).toBeTruthy();
    expect(screen.getByText('Played')).toBeTruthy();
    expect(screen.getByText('60%')).toBeTruthy();
    expect(screen.getByText('3d')).toBeTruthy();
    expect(screen.queryByTestId('guest-banner')).toBeNull();
  });

  it('unverified email shows the verify action which sends a code and opens OTP', async () => {
    useAuthStore.setState({ status: 'signedIn', user: makeMe() });
    api.resendVerification.mockResolvedValue({ sent: true, retryAfterSec: 60 });
    await render(withClient(<UserProfileScreen />));
    await press('verify-email');
    await waitFor(() => expect(mockNav.navigate).toHaveBeenCalledWith('otp_verification', { email: 'aiden@example.com', purpose: 'verify' }));
  });

  it('verified email shows a badge instead of the action', async () => {
    useAuthStore.setState({ status: 'signedIn', user: makeMe({ emailVerified: true }) });
    await render(withClient(<UserProfileScreen />));
    expect(screen.getByText('Email verified (aiden@example.com)')).toBeTruthy();
    expect(screen.queryByTestId('verify-email')).toBeNull();
  });

  it('guest sees the upgrade banner leading to registration', async () => {
    useAuthStore.setState({ status: 'signedIn', user: makeMe({ accountType: 'GUEST', email: null }) });
    await render(withClient(<UserProfileScreen />));
    expect(screen.getByTestId('guest-banner')).toBeTruthy();
    await press('guest-create-account');
    expect(mockNav.navigate).toHaveBeenCalledWith('registration');
    expect(screen.queryByTestId('email-status')).toBeNull();
  });

  it('quick links navigate', async () => {
    useAuthStore.setState({ status: 'signedIn', user: makeMe() });
    await render(withClient(<UserProfileScreen />));
    await press('profile-edit');
    expect(mockNav.navigate).toHaveBeenCalledWith('edit_profile');
    await fireEvent.press(screen.getByLabelText('Statistics'));
    expect(mockNav.navigate).toHaveBeenCalledWith('game_statistics');
    await fireEvent.press(screen.getByLabelText('Settings'));
    expect(mockNav.navigate).toHaveBeenCalledWith('settings');
  });

  it('shows a loader without a user and an offline error state when the load failed', async () => {
    useAuthStore.setState({ status: 'signedIn', user: null });
    users.me.mockRejectedValue(new ApiError('NETWORK_ERROR', 'offline'));
    await render(withClient(<UserProfileScreen />));
    expect(await screen.findByText('No Internet Connection')).toBeTruthy();
  });
});

void Alert;
