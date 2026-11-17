import React, { useState } from 'react';
import {
  Bell,
  ChevronRight,
  Globe,
  HelpCircle,
  Info,
  LogOut,
  Music,
  Palette,
  Shield,
  Smartphone,
  Volume2,
} from 'lucide-react';
import {
  AppButton,
  AppCard,
  AppHeader,
  ConfirmationDialog,
  ThemeCard,
} from '../components/ds/DesignSystemComponents';
import { THEME_LIST } from '../data/mockData';
import { ScreenId, ThemeId } from '../types/app';

export interface SettingsThemeScreensProps {
  screen: ScreenId;
  activeTheme: ThemeId;
  settings: {
    soundEffects: boolean;
    music: boolean;
    vibration: boolean;
    notifications: boolean;
    language: string;
  };
  onUpdateSettings: (patch: Partial<SettingsThemeScreensProps['settings']>) => void;
  onSelectTheme: (theme: ThemeId) => void;
  onNavigate: (screen: ScreenId) => void;
  onBack: () => void;
  onNotify: (title: string, message?: string) => void;
}

const ToggleSwitch: React.FC<{ checked: boolean; onChange: () => void; label: string }> = ({
  checked,
  onChange,
  label,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={onChange}
    className={`w-12 h-7 rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
      checked ? 'bg-[#8B5CF6]' : 'bg-[var(--bg-secondary)] border border-[var(--border-color)]'
    }`}
  >
    <span
      className={`block w-5 h-5 rounded-full bg-white transition-transform duration-150 ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);

export const SettingsThemeScreens: React.FC<SettingsThemeScreensProps> = ({
  screen,
  activeTheme,
  settings,
  onUpdateSettings,
  onSelectTheme,
  onNavigate,
  onBack,
  onNotify,
}) => {
  const [pendingTheme, setPendingTheme] = useState<ThemeId>(activeTheme);
  const [confirmLogout, setConfirmLogout] = useState(false);

  /* 39. Settings Screen */
  if (screen === 'settings') {
    const currentThemeObj = THEME_LIST.find((t) => t.id === activeTheme) || THEME_LIST[0];

    return (
      <div className="flex-1 flex flex-col min-h-0 relative">
        <AppHeader title="Settings" onBack={onBack} />
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
          {/* Audio & Haptics */}
          <AppCard className="space-y-3.5">
            <h3 className="text-xs font-semibold text-[var(--text-secondary)]">Audio &amp; Haptics</h3>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Volume2 className="w-4 h-4 text-[#8B5CF6]" />
                <span className="text-sm font-medium text-[var(--text-primary)]">Sound Effects</span>
              </div>
              <ToggleSwitch
                label="Toggle sound effects"
                checked={settings.soundEffects}
                onChange={() => onUpdateSettings({ soundEffects: !settings.soundEffects })}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Music className="w-4 h-4 text-[#38BDF8]" />
                <span className="text-sm font-medium text-[var(--text-primary)]">Background Music</span>
              </div>
              <ToggleSwitch
                label="Toggle background music"
                checked={settings.music}
                onChange={() => onUpdateSettings({ music: !settings.music })}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Smartphone className="w-4 h-4 text-[#F472B6]" />
                <span className="text-sm font-medium text-[var(--text-primary)]">Vibration</span>
              </div>
              <ToggleSwitch
                label="Toggle vibration"
                checked={settings.vibration}
                onChange={() => onUpdateSettings({ vibration: !settings.vibration })}
              />
            </div>
          </AppCard>

          {/* Preferences */}
          <AppCard className="space-y-3.5">
            <h3 className="text-xs font-semibold text-[var(--text-secondary)]">Preferences</h3>

            <button
              type="button"
              onClick={() => onNavigate('theme_selection')}
              className="w-full min-h-[44px] flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Palette className="w-4 h-4 text-[#8B5CF6]" />
                <span className="text-sm font-medium text-[var(--text-primary)]">Board Theme</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                <span>{currentThemeObj.name}</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Bell className="w-4 h-4 text-[#FBBF24]" />
                <span className="text-sm font-medium text-[var(--text-primary)]">Notifications</span>
              </div>
              <ToggleSwitch
                label="Toggle notifications"
                checked={settings.notifications}
                onChange={() => onUpdateSettings({ notifications: !settings.notifications })}
              />
            </div>

            <button
              type="button"
              onClick={() => {
                const langs = ['English (US)', 'Spanish', 'Japanese', 'German'];
                const next = langs[(langs.indexOf(settings.language) + 1) % langs.length];
                onUpdateSettings({ language: next });
                onNotify('Language Updated', next);
              }}
              className="w-full min-h-[44px] flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Globe className="w-4 h-4 text-[#22C55E]" />
                <span className="text-sm font-medium text-[var(--text-primary)]">Language</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                <span>{settings.language}</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          </AppCard>

          {/* Support & About */}
          <AppCard className="space-y-1">
            <button
              type="button"
              onClick={() => onNotify('Help Center', 'FAQ & match support opened')}
              className="w-full min-h-[44px] flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <HelpCircle className="w-4 h-4 text-[var(--text-secondary)]" />
                <span className="text-sm text-[var(--text-primary)]">Help &amp; Support</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
            <button
              type="button"
              onClick={() => onNotify('Privacy Policy', 'Zero third-party ad tracking')}
              className="w-full min-h-[44px] flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-[var(--text-secondary)]" />
                <span className="text-sm text-[var(--text-primary)]">Privacy Policy</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
            <button
              type="button"
              onClick={() => onNotify('Tic Tac Toe', 'Build 2.4.0 · Android & iOS')}
              className="w-full min-h-[44px] flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Info className="w-4 h-4 text-[var(--text-secondary)]" />
                <span className="text-sm text-[var(--text-primary)]">About Application</span>
              </div>
              <span className="text-xs font-mono-num text-[var(--text-secondary)]">2.4.0</span>
            </button>
          </AppCard>

          <AppButton
            fullWidth
            variant="danger"
            icon={<LogOut className="w-4 h-4" />}
            onClick={() => setConfirmLogout(true)}
          >
            Log Out
          </AppButton>
        </div>

        <ConfirmationDialog
          open={confirmLogout}
          title="Log Out?"
          message="You can sign back in anytime using your email, Google, or Apple account."
          confirmLabel="Log Out"
          cancelLabel="Cancel"
          destructive
          onConfirm={() => {
            setConfirmLogout(false);
            onNotify('Signed Out');
            onNavigate('welcome');
          }}
          onCancel={() => setConfirmLogout(false)}
        />
      </div>
    );
  }

  /* 40. Theme Selection Screen */
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <AppHeader title="Theme Selection" subtitle="Live board & surface preview" onBack={onBack} />
      <div className="flex-1 overflow-y-auto no-scrollbar p-4">
        <div className="grid grid-cols-2 gap-3">
          {THEME_LIST.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              selected={pendingTheme === theme.id}
              onSelect={() => {
                setPendingTheme(theme.id);
                onSelectTheme(theme.id);
              }}
            />
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-[var(--border-color)]/60">
        <AppButton
          fullWidth
          onClick={() => {
            onSelectTheme(pendingTheme);
            onNotify('Theme Applied', `${THEME_LIST.find((t) => t.id === pendingTheme)?.name} active`);
            onNavigate('settings');
          }}
        >
          Apply Theme
        </AppButton>
      </div>
    </div>
  );
};
