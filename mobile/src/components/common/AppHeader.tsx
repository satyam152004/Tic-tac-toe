import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { iconSize } from '../../design-system/icons';
import { radius } from '../../design-system/radius';
import { layout } from '../../design-system/spacing';
import { type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { Pressy } from './Pressy';

export const AppHeader: React.FC<{
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  /** Set false when the header sits inside a screen that already pads for the status bar. */
  safeTop?: boolean;
}> = ({ title, subtitle, onBack, rightAction, safeTop = true }) => {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { borderBottomColor: c.border, backgroundColor: c.bgPrimary, paddingTop: safeTop ? insets.top + 8 : 8 }]}>
      <View style={styles.side}>
        {onBack ? (
          <Pressy
            testID="header-back"
            accessibilityLabel="Go back"
            onPress={onBack}
            style={[styles.back, { backgroundColor: c.bgCard, borderColor: c.border }]}
          >
            <ChevronLeft size={iconSize.md} color={c.text} />
          </Pressy>
        ) : null}
      </View>
      <View style={styles.mid}>
        <Text accessibilityRole="header" numberOfLines={1} style={[type.heading, { color: c.text, textAlign: 'center' }]}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={[type.caption, { color: c.textSecondary, textAlign: 'center' }]}>{subtitle}</Text> : null}
      </View>
      <View style={[styles.side, { alignItems: 'flex-end' }]}>{rightAction}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { minHeight: 54, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  side: { width: 48, justifyContent: 'center' },
  mid: { flex: 1, minWidth: 0 },
  back: { width: layout.minTouch, height: layout.minTouch, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
