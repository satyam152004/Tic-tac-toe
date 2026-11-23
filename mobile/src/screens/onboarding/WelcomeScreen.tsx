import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { fonts } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { friendlyMessage } from '../../services/api/errors';
import { signInWithApple, signInWithGoogle, socialProviders } from '../../services/socialAuth';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import { MarkX, MUTED, ProtoButton, SocialButton } from '../auth/protoUi';

type Action = 'google' | 'apple' | 'guest';

export const WelcomeScreen: React.FC<RootScreenProps<'welcome'>> = () => {
  const c = useTheme();
  const { nav, resetTo } = useAppNav();
  const [busy, setBusy] = useState<Action | null>(null);

  const run = async (action: Action, fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(action);
    try {
      await fn();
      resetTo('Main');
    } catch (e) {
      if (!(e instanceof Error && e.message === 'CANCELLED')) {
        toast.error('Sign-in failed', friendlyMessage(e));
      }
      setBusy(null);
    }
  };

  return (
    <Screen testID="welcome-screen" scroll={false} padded={false} gap={0}>
      <View style={styles.screen}>
      <View style={styles.hero}>
        <View style={[styles.markCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <MarkX size={22} stroke={2.5} />
        </View>
        <Text style={[styles.title, { color: c.text }]}>Ready to Play?</Text>
        <Text style={[styles.subtitle, { color: c.textSecondary }]}>
          Sync your ELO rating, match history, and friends across devices.
        </Text>
      </View>

      <View style={styles.actions}>
        <ProtoButton testID="welcome-register" title="Create Account" disabled={!!busy} onPress={() => nav.navigate('registration')} />
        <ProtoButton testID="welcome-email" title="Sign In" variant="secondary" disabled={!!busy} onPress={() => nav.navigate('login')} />

        <View style={styles.divider}>
          <View style={[styles.line, { backgroundColor: c.border }]} />
          <Text style={[styles.dividerText, { color: MUTED }]}>or continue with</Text>
          <View style={[styles.line, { backgroundColor: c.border }]} />
        </View>

        <View style={styles.socialRow}>
          {socialProviders.google ? (
            <SocialButton testID="welcome-google" provider="google" busy={busy === 'google'} disabled={!!busy} onPress={() => void run('google', signInWithGoogle)} />
          ) : null}
          {socialProviders.apple ? (
            <SocialButton testID="welcome-apple" provider="apple" busy={busy === 'apple'} disabled={!!busy} onPress={() => void run('apple', signInWithApple)} />
          ) : null}
        </View>

        <ProtoButton
          testID="welcome-guest"
          title="Continue as Guest"
          variant="ghost"
          height={32}
          fontSize={12}
          loading={busy === 'guest'}
          disabled={!!busy}
          onPress={() => void run('guest', () => useAuthStore.getState().continueAsGuest())}
        />
      </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, justifyContent: 'space-between' },
  hero: { alignItems: 'center', marginTop: 12 },
  markCard: { width: 48, height: 48, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontFamily: fonts.body.semibold, fontSize: 21, lineHeight: 27, letterSpacing: -0.42, textAlign: 'center' },
  subtitle: { fontFamily: fonts.body.regular, fontSize: 12.5, lineHeight: 18, marginTop: 4, maxWidth: 240, textAlign: 'center' },
  actions: { paddingTop: 12, gap: 10 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  line: { flex: 1, height: 1 },
  dividerText: { fontFamily: fonts.body.regular, fontSize: 10.5 },
  socialRow: { flexDirection: 'row', gap: 8 },
});
