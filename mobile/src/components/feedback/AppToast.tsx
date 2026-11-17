import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react-native';
import { type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useToastStore } from '../../store/toastStore';
import { Pressy } from '../common/Pressy';

/** Mount once at the app root; driven by `toast.*` helpers. Auto-dismisses after 3.5 s. */
export const AppToastHost: React.FC = () => {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { toast, dismiss } = useToastStore();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismiss, 3500);
    return () => clearTimeout(t);
  }, [toast, dismiss]);

  if (!toast) return null;
  const icon =
    toast.type === 'success' ? <CheckCircle2 size={16} color={c.success} /> :
    toast.type === 'error' ? <AlertTriangle size={16} color={c.danger} /> :
    toast.type === 'warning' ? <AlertTriangle size={16} color={c.warning} /> :
    <Info size={16} color={c.x} />;

  return (
    <Animated.View
      key={toast.id}
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

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, zIndex: 100 },
  toast: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, elevation: 8, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
});
