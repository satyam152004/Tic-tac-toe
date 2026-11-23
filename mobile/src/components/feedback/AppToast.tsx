import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { lift } from '../../design-system/shadows';
import { fonts } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useToastStore } from '../../store/toastStore';
import { Pressy } from '../common/Pressy';

/** Presentational toast. Reads the shared toast store; the store owns the auto-dismiss timer. */
const ToastView: React.FC = () => {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToastStore((s) => s.toast);
  const dismiss = useToastStore((s) => s.dismiss);

  if (!toast) return null;
  const dot = toast.type === 'success' ? c.success : toast.type === 'error' ? c.danger : toast.type === 'warning' ? c.warning : c.accent;

  return (
    <Animated.View
      key={toast.id}
      testID="app-toast"
      entering={FadeInUp.duration(180)}
      exiting={FadeOutUp.duration(150)}
      pointerEvents="box-none"
      style={[styles.wrap, { top: insets.top + 6 }]}
    >
      <Pressy accessibilityLabel="Dismiss notification" onPress={dismiss} style={styles.toast}>
        <View accessibilityLiveRegion="polite" style={styles.row}>
          <View style={[styles.dot, { backgroundColor: dot }]} />
          <View style={{ flexShrink: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={styles.title}>{toast.title}</Text>
            {toast.message ? <Text numberOfLines={2} style={styles.message}>{toast.message}</Text> : null}
          </View>
        </View>
      </Pressy>
    </Animated.View>
  );
};

/**
 * Mount once at the app root; driven by `toast.*` helpers.
 *
 * Why this is not just a bigger zIndex: React Native `<Modal>` and modal-presented native-stack screens live in their
 * own native window / view controller, which always draws above the root view. Nothing rendered in the root tree can
 * overtake them, whatever its zIndex or elevation. So while any such overlay is open (`overlayCount > 0`) the root host
 * yields and the overlay's own `OverlayToast` shows the toast. Exactly one toast is ever visible.
 */
export const AppToastHost: React.FC = () => {
  const hidden = useToastStore((s) => s.overlayCount > 0);
  return hidden ? null : <ToastView />;
};

/**
 * Render as the last child inside a native overlay (inside the `<Modal>` content, or in a modal-presented screen).
 * While mounted it takes over toast rendering from the root host.
 */
export const OverlayToast: React.FC = () => {
  useEffect(() => useToastStore.getState().pushOverlay(), []);
  return <ToastView />;
};

/** Wrap a screen that is presented with `presentation: 'modal'` so toasts show above it. */
export function withOverlayToast<P extends object>(Component: React.ComponentType<P>): React.FC<P> {
  const Wrapped: React.FC<P> = (props) => (
    <View style={styles.fill}>
      <Component {...props} />
      <OverlayToast />
    </View>
  );
  Wrapped.displayName = `withOverlayToast(${Component.displayName ?? Component.name ?? 'Screen'})`;
  return Wrapped;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  wrap: { position: 'absolute', left: 16, right: 16, zIndex: 100, elevation: 100, alignItems: 'center' },
  toast: { backgroundColor: '#141518', borderRadius: 22, paddingHorizontal: 14, paddingVertical: 8, maxWidth: '100%', ...lift },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { color: '#FFFFFF', fontSize: 11.5, lineHeight: 16, fontFamily: fonts.body.medium },
  message: { color: 'rgba(255,255,255,0.72)', fontSize: 10.5, lineHeight: 14, fontFamily: fonts.body.regular },
});
