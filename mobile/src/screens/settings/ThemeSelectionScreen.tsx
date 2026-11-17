import React from 'react';
import { Text, View } from 'react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { Screen } from '../../components/common/Screen';
import { GameBoard } from '../../components/game/GameBoard';
import { ThemeCard } from '../../components/profile/Cards';
import type { ThemeId } from '../../design-system/colors';
import { THEME_LIST } from '../../design-system/themes';
import { type } from '../../design-system/typography';
import { useUpdateProfile } from '../../hooks/queries';
import { useTheme } from '../../hooks/useTheme';
import type { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';
import { friendlyMessage } from '../../services/api/errors';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { toast } from '../../store/toastStore';

const PREVIEW = ['X', 'O', '', '', 'X', 'O', 'O', '', 'X'] as Array<'X' | 'O' | ''>;

export const ThemeSelectionScreen: React.FC<RootScreenProps<'theme_selection'>> = () => {
  const c = useTheme();
  const { back } = useAppNav();
  const theme = useSettingsStore((s) => s.theme);
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  const update = useUpdateProfile();

  const select = (id: ThemeId) => {
    if (id === theme) return;
    useSettingsStore.getState().set({ theme: id }); // instant, app-wide, works offline
    if (!signedIn) return;
    update.mutateAsync({ theme: id }).catch((e: unknown) => {
      toast.warning('Theme saved on this device only', friendlyMessage(e));
    });
  };

  const active = THEME_LIST.find((t) => t.id === theme) ?? THEME_LIST[0];

  return (
    <Screen
      title="Theme Selection"
      subtitle="Live board & surface preview"
      onBack={back}
      footer={
        <AppButton
          testID="apply-theme"
          fullWidth
          title="Apply Theme"
          onPress={() => {
            toast.success('Theme Applied', `${active.name} active`);
            back();
          }}
        />
      }
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {THEME_LIST.map((t) => (
          <View key={t.id} style={{ width: '48%', flexGrow: 1 }}>
            <ThemeCard theme={t} selected={theme === t.id} onSelect={() => select(t.id)} />
          </View>
        ))}
      </View>

      <AppCard style={{ gap: 12 }}>
        <Text style={[type.subheading, { color: c.text }]}>Preview · {active.name}</Text>
        <GameBoard compact disabled board={PREVIEW} size={3} winningLine={[0, 4, 8]} maxSize={220} />
      </AppCard>
    </Screen>
  );
};
