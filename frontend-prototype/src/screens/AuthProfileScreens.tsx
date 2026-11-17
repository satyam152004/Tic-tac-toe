import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  Globe,
  History,
  Settings,
  Shield,
} from 'lucide-react';
import {
  AppButton,
  AppCard,
  AppHeader,
  BottomNavigation,
  PlayerAvatar,
  ScoreCard,
} from '../components/ds/DesignSystemComponents';
import { AVATAR_PRESETS } from '../data/mockData';
import { PlayerProfile, ScreenId } from '../types/app';

export interface AuthProfileScreensProps {
  screen: ScreenId;
  user: PlayerProfile;
  onUpdateProfile: (patch: Partial<PlayerProfile>) => void;
  onNavigate: (screen: ScreenId) => void;
  onBack: () => void;
  onNotify: (title: string, message?: string) => void;
}

export const AuthProfileScreens: React.FC<AuthProfileScreensProps> = ({
  screen,
  user,
  onUpdateProfile,
  onNavigate,
  onBack,
  onNotify,
}) => {
  // Login state
  const [loginEmail, setLoginEmail] = useState('aiden.vance@example.com');
  const [loginPassword, setLoginPassword] = useState('ArenaPlayer2026');
  const [showPass, setShowPass] = useState(false);

  // Registration state
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(true);

  // OTP state
  const [otpDigits, setOtpDigits] = useState(['4', '8', '2', '9', '1', '0']);
  const [otpTimer, setOtpTimer] = useState(28);

  // Forgot Password state
  const [resetTarget, setResetTarget] = useState('aiden.vance@example.com');
  const [resetSent, setResetSent] = useState(false);

  // Edit Profile state
  const [editUsername, setEditUsername] = useState(user.username);
  const [editBio, setEditBio] = useState(user.bio);
  const [editAvatar, setEditAvatar] = useState(user.avatarId);

  useEffect(() => {
    if (screen !== 'otp_verification') return;
    const t = window.setInterval(() => {
      setOtpTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(t);
  }, [screen]);

  /* 27. Login Screen */
  if (screen === 'login') {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <AppHeader title="Sign In" onBack={onBack} />
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
          <div className="space-y-1">
            <h2 className="font-display font-bold text-xl text-[var(--text-primary)]">
              Welcome Back
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Sign in to continue your ranked streak.
            </p>
          </div>

          <AppCard className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full h-11 pl-3.5 pr-11 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#8B5CF6]"
                />
                <button
                  type="button"
                  aria-label="Toggle password visibility"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-1 top-1 w-9 h-9 flex items-center justify-center text-[var(--text-secondary)] cursor-pointer"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="text-right">
              <button
                type="button"
                onClick={() => onNavigate('forgot_password')}
                className="text-xs font-semibold text-[#8B5CF6] hover:underline cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
          </AppCard>

          <AppButton
            fullWidth
            onClick={() => {
              onNotify('Verification Required', 'Enter the 6-digit OTP code');
              onNavigate('otp_verification');
            }}
          >
            Sign In
          </AppButton>

          <div className="grid grid-cols-2 gap-2.5">
            <AppButton
              variant="secondary"
              size="md"
              icon={<Globe className="w-4 h-4 text-[#38BDF8]" />}
              onClick={() => onNavigate('home')}
            >
              Google
            </AppButton>
            <AppButton
              variant="secondary"
              size="md"
              icon={<Shield className="w-4 h-4" />}
              onClick={() => onNavigate('home')}
            >
              Apple
            </AppButton>
          </div>

          <p className="text-center text-xs text-[var(--text-secondary)] pt-2">
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={() => onNavigate('registration')}
              className="text-[#8B5CF6] font-semibold hover:underline cursor-pointer"
            >
              Sign up
            </button>
          </p>
        </div>
      </div>
    );
  }

  /* 28. Registration Screen */
  if (screen === 'registration') {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <AppHeader title="Create Account" onBack={onBack} />
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3">
          <AppCard className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Username
              </label>
              <input
                type="text"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                placeholder="e.g. TacticalAlex"
                className="w-full h-11 px-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Email
              </label>
              <input
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="you@domain.com"
                className="w-full h-11 px-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                placeholder="+1 (555) 234-8910"
                className="w-full h-11 px-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={regPass}
                  onChange={(e) => setRegPass(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 px-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Confirm
                </label>
                <input
                  type="password"
                  value={regConfirm}
                  onChange={(e) => setRegConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 px-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)]"
                />
              </div>
            </div>

            <label className="flex items-center gap-2.5 text-xs text-[var(--text-secondary)] cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="w-4 h-4 accent-[#8B5CF6]"
              />
              <span>I agree to the Terms of Service and Fair Play Policy</span>
            </label>
          </AppCard>
        </div>

        <div className="p-4 border-t border-[var(--border-color)]/60">
          <AppButton
            fullWidth
            disabled={!termsAccepted}
            onClick={() => {
              if (regUsername.trim()) {
                onUpdateProfile({ username: regUsername.trim(), isGuest: false });
              }
              onNavigate('otp_verification');
            }}
          >
            Sign Up
          </AppButton>
        </div>
      </div>
    );
  }

  /* 29. OTP Verification Screen */
  if (screen === 'otp_verification') {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <AppHeader title="OTP Verification" onBack={onBack} />
        <div className="flex-1 flex flex-col justify-between p-5">
          <div className="space-y-6 pt-4">
            <div className="text-center space-y-1.5">
              <h2 className="font-display font-bold text-xl text-[var(--text-primary)]">
                Enter Verification Code
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                We sent a 6-digit security code to your registered device.
              </p>
            </div>

            <div className="grid grid-cols-6 gap-2">
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => {
                    const next = [...otpDigits];
                    next[idx] = e.target.value.replace(/\D/g, '');
                    setOtpDigits(next);
                  }}
                  aria-label={`OTP digit ${idx + 1}`}
                  className="h-13 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-center font-mono-num font-bold text-lg text-[var(--text-primary)] focus:outline-none focus:border-[#8B5CF6]"
                />
              ))}
            </div>

            <div className="text-center text-xs text-[var(--text-secondary)]">
              {otpTimer > 0 ? (
                <span className="font-mono-num">Resend code in 00:{String(otpTimer).padStart(2, '0')}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setOtpTimer(30);
                    onNotify('OTP Resent', 'A fresh 6-digit code has been sent');
                  }}
                  className="text-[#8B5CF6] font-semibold hover:underline cursor-pointer"
                >
                  Resend OTP Code
                </button>
              )}
            </div>
          </div>

          <AppButton
            fullWidth
            onClick={() => {
              onNotify('Account Verified', 'Welcome to the Arena');
              onNavigate('home');
            }}
          >
            Verify &amp; Continue
          </AppButton>
        </div>
      </div>
    );
  }

  /* 30. Forgot Password Screen */
  if (screen === 'forgot_password') {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <AppHeader title="Forgot Password" onBack={onBack} />
        <div className="flex-1 flex flex-col justify-between p-5">
          {resetSent ? (
            <AppCard padding="lg" className="text-center space-y-4 my-auto">
              <CheckCircle2 className="w-12 h-12 text-[#22C55E] mx-auto" />
              <div>
                <h2 className="font-display font-bold text-lg text-[var(--text-primary)]">
                  Reset Link Sent
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                  Check <span className="text-[var(--text-primary)]">{resetTarget}</span> for
                  instructions to reset your password.
                </p>
              </div>
              <AppButton fullWidth onClick={() => onNavigate('login')}>
                Back to Login
              </AppButton>
            </AppCard>
          ) : (
            <>
              <div className="space-y-4 pt-2">
                <div>
                  <h2 className="font-display font-bold text-xl text-[var(--text-primary)]">
                    Recover Access
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    Enter your email address or phone number to receive a recovery link.
                  </p>
                </div>

                <AppCard>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                    Email or Phone
                  </label>
                  <input
                    type="text"
                    value={resetTarget}
                    onChange={(e) => setResetTarget(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)]"
                  />
                </AppCard>
              </div>

              <AppButton
                fullWidth
                onClick={() => {
                  setResetSent(true);
                  onNotify('Reset Link Dispatched');
                }}
              >
                Send Reset Link
              </AppButton>
            </>
          )}
        </div>
      </div>
    );
  }

  /* 31. User Profile Screen */
  if (screen === 'user_profile') {
    const total = user.wins + user.losses + user.draws;
    const winPct = total > 0 ? Math.round((user.wins / total) * 100) : 0;
    const xpPct = Math.round((user.xp / user.xpMax) * 100);

    return (
      <div className="flex-1 flex flex-col min-h-0">
        <AppHeader
          title="Player Profile"
          onBack={onBack}
          rightAction={
            <button
              type="button"
              aria-label="Settings"
              onClick={() => onNavigate('settings')}
              className="w-11 h-11 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <Settings className="w-5 h-5" />
            </button>
          }
        />

        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
          <AppCard className="space-y-4">
            <div className="flex items-center gap-3.5">
              <PlayerAvatar avatarId={user.avatarId} name={user.username} size="xl" status="online" activeRing />
              <div className="flex-1 min-w-0">
                <h2 className="font-display font-bold text-lg text-[var(--text-primary)] truncate">
                  {user.username}
                </h2>
                <div className="text-xs text-[var(--text-secondary)] font-mono-num">
                  Level {user.level} · {user.rating} Rating
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">{user.bio}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] font-mono-num">
                <span>XP Progress</span>
                <span>
                  {user.xp} / {user.xpMax} XP
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#38BDF8]"
                  style={{ width: `${xpPct}%` }}
                />
              </div>
            </div>
          </AppCard>

          <div className="grid grid-cols-2 gap-2.5">
            <ScoreCard label="Wins" value={user.wins} tone="success" />
            <ScoreCard label="Win Percentage" value={`${winPct}%`} tone="accent" />
            <ScoreCard label="Losses" value={user.losses} />
            <ScoreCard label="Draws" value={user.draws} tone="warning" />
          </div>

          <div className="space-y-2.5">
            <AppButton
              fullWidth
              variant="secondary"
              icon={<Edit3 className="w-4 h-4" />}
              onClick={() => onNavigate('edit_profile')}
            >
              Edit Profile
            </AppButton>
            <div className="grid grid-cols-2 gap-2.5">
              <AppButton
                variant="outline"
                size="md"
                icon={<BarChart3 className="w-4 h-4" />}
                onClick={() => onNavigate('game_statistics')}
              >
                Statistics
              </AppButton>
              <AppButton
                variant="outline"
                size="md"
                icon={<History className="w-4 h-4" />}
                onClick={() => onNavigate('offline_history')}
              >
                History
              </AppButton>
            </div>
          </div>
        </div>

        <BottomNavigation activeTab="profile" onNavigate={onNavigate} />
      </div>
    );
  }

  /* 32. Edit Profile Screen */
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <AppHeader title="Edit Profile" onBack={onBack} />
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
        <div className="flex flex-col items-center gap-3 py-2">
          <PlayerAvatar avatarId={editAvatar} name={editUsername} size="xl" activeRing />
          <div className="flex items-center gap-2">
            {AVATAR_PRESETS.slice(0, 5).map((av) => (
              <button
                key={av.id}
                type="button"
                onClick={() => setEditAvatar(av.id)}
                className="cursor-pointer rounded-2xl p-0.5"
              >
                <PlayerAvatar
                  avatarId={av.id}
                  size="sm"
                  activeRing={editAvatar === av.id}
                />
              </button>
            ))}
          </div>
        </div>

        <AppCard className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Username
            </label>
            <input
              type="text"
              value={editUsername}
              onChange={(e) => setEditUsername(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Player Bio
            </label>
            <textarea
              rows={3}
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              className="w-full p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] resize-none"
            />
          </div>
        </AppCard>
      </div>

      <div className="p-4 border-t border-[var(--border-color)]/60">
        <AppButton
          fullWidth
          onClick={() => {
            onUpdateProfile({
              username: editUsername.trim() || user.username,
              bio: editBio.trim(),
              avatarId: editAvatar,
            });
            onNotify('Profile Updated', 'Your changes have been saved');
            onNavigate('user_profile');
          }}
        >
          Save Changes
        </AppButton>
      </div>
    </div>
  );
};
