import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { AppButton } from '../../components/common/AppButton';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { THEME_COLORS, type ThemeId } from '../../design-system/colors';
import { THEME_LIST } from '../../design-system/themes';
import { fonts } from '../../design-system/typography';
import { useUpdateProfile } from '../../hooks/queries';
import { useTheme } from '../../hooks/useTheme';
import type { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';
import { friendlyMessage } from '../../services/api/errors';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { toast } from '../../store/toastStore';

import { fs, ms } from '../../design-system/responsive';
const DESCRIPTIONS: Partial<Record<ThemeId, string>> = {
  light: 'Light and clean with a blue accent',
  classic: 'Soft cream background',
  dark: 'Dark and easy on the eyes',
};
const PROTOTYPE_THEMES: ThemeId[] = ['light', 'classic', 'dark'];

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
  // The kit offers three themes; a previously chosen extra theme stays listed so it can still be seen and changed.
  const shown = THEME_LIST.filter((t) => PROTOTYPE_THEMES.includes(t.id) || t.id === theme);

  return (
    <Screen
      title="Theme"
      onBack={back}
      gap={12}
      footer={
        <AppButton
          testID="apply-theme"
          fullWidth
          title="Apply Theme"
          onPress={() => {
            toast.success('Theme changed', `${active.name} is on`);
            back();
          }}
        />
      }
    >
      {shown.map((t) => {
        const sel = theme === t.id;
        const tc = THEME_COLORS[t.id];
        return (
          <Pressy
            key={t.id}
            testID={`theme-${t.id}`}
            accessibilityLabel={`${t.name}${sel ? ', selected' : ''}`}
            accessibilityState={{ selected: sel }}
            scaleTo={0.99}
            onPress={() => select(t.id)}
            style={[
              styles.card,
              sel
                ? { backgroundColor: c.accent + '1A', borderColor: c.accent, borderWidth: 1.5 }
                : { backgroundColor: c.bgCard, borderColor: c.border, borderWidth: 1 },
            ]}
          >
            <View style={styles.left}>
              <View style={[styles.swatch, { backgroundColor: tc.bgPrimary }]}>
                {(['X', null, null, 'O'] as const).map((m, i) => (
                  <View key={i} style={[styles.cell, { backgroundColor: tc.bgCard }]}>
                    {m ? <Text style={[styles.cellText, { color: tc.x }]}>{m}</Text> : null}
                  </View>
                ))}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: c.text }]}>
                  {t.name}
                  {sel ? ' — Active' : ''}
                </Text>
                <Text style={[styles.desc, { color: c.textSecondary }]}>{DESCRIPTIONS[t.id] ?? t.subtitle}</Text>
              </View>
            </View>
            <View style={[styles.radio, sel ? { backgroundColor: c.accent } : { borderWidth: 1, borderColor: '#CFCFC8' }]}>
              {sel ? <Check size={ms(14)} color="#FFFFFF" strokeWidth={3} /> : null}
            </View>
          </Pressy>
        );
      })}
    </Screen>
  );
};

// Swatch = 2x2 mini board. Cell size is computed in whole points (border-box): percent widths plus the gap overflow the
// inner width and the second cell wraps, which turned the grid into a single column.
const SWATCH = ms(60);
const SWATCH_PAD = ms(8);
const SWATCH_GAP = ms(5);
const CELL = Math.floor((SWATCH - 2 - SWATCH_PAD * 2 - SWATCH_GAP) / 2);

const styles = StyleSheet.create({
  card: { padding: ms(14), borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  left: { flexDirection: 'row', alignItems: 'center', gap: ms(14), flex: 1 },
  swatch: { width: SWATCH, height: SWATCH, borderRadius: 12, borderWidth: 1, borderColor: '#CFCFC8', padding: SWATCH_PAD, flexDirection: 'row', flexWrap: 'wrap', gap: SWATCH_GAP },
  cell: { width: CELL, height: CELL, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontSize: ms(11), fontFamily: fonts.body.semibold, lineHeight: ms(14) },
  name: { fontSize: fs(13.5), lineHeight: Math.round(fs(13.5) * 1.3), fontFamily: fonts.body.semibold },
  desc: { fontSize: fs(11.5), lineHeight: Math.round(fs(11.5) * 1.3), marginTop: 2 },
  radio: { width: ms(24), height: ms(24), borderRadius: ms(12), alignItems: 'center', justifyContent: 'center' },
});
