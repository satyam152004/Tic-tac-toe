import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react-native';
import { lift } from '../../design-system/shadows';
import { type } from '../../design-system/typography';
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
  const icon =
    toast.type === 'success' ? <CheckCircle2 size={16} color={c.success} /> :
    toast.type === 'error' ? <AlertTriangle size={16} color={c.danger} /> :
    toast.type === 'warning' ? <AlertTriangle size={16} color={c.warning} /> :
    <Info size={16} color={c.x} />;

  return (
    <Animated.View
      key={toast.id}
      testID="app-toast"
      entering={FadeInUp.duration(180)}
      exiting={FadeOutUp.duration(150)}
      pointerEvents="box-none"
      style={[styles.wrap, { top: insets.top + 8 }]}
    >
      <View accessibilityLiveRegion="polite" style={[styles.toast, { backgroundColor: c.bgElevated, borderColor: c.border }]}>
        {icon}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[type.bodyStrong, { color: c.text }]}>{toast.title}</Text>
          {toast.message ? <Text numberOfLines={2} style={[type.caption, { color: c.textSecondary }]}>{toast.message}</Text> : null}
        </View>
        <Pressy accessibilityLabel="Dismiss notification" onPress={dismiss} hitSlop={10}>
          <X size={14} color={c.textSecondary} />
        </Pressy>
      </View>
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
  wrap: { position: 'absolute', left: 16, right: 16, zIndex: 100, elevation: 100 },
  toast: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, ...lift },
});
