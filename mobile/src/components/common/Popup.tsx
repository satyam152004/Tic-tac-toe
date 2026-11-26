import { X } from 'lucide-react-native';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius } from '../../design-system/radius';
import { space } from '../../design-system/spacing';
import { type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { OverlayToast } from '../feedback/AppToast';
import { AppButton } from './AppButton';
import { Pressy } from './Pressy';

import { ms } from '../../design-system/responsive';

/**
 * THE app popup. Every popup in the app is drawn by this one component. Each feature keeps its own logic and passes in
 * its title, text, buttons and content.
 *
 *  layout 'center' (default): a card in the middle with a title, message, optional badge and buttons.
 *  layout 'sheet':            a card sliding up from the bottom with a handle, a title and a close button. Used for
 *                             lists and forms; put the content in children.
 *
 *  presentation 'modal' (default): a native window over the app. Tap outside or Android back calls onDismiss.
 *  presentation 'overlay':         a plain view over the current screen (the game pause). Tap outside does nothing.
 */
export interface PopupAction {
  testID?: string;
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}

export interface PopupProps {
  open: boolean;
  title: string;
  message?: string;
  messageTestID?: string;
  layout?: 'center' | 'sheet';
  presentation?: 'modal' | 'overlay';
  /** Small element above the title, e.g. a countdown badge. */
  badge?: React.ReactNode;
  /** Content between the text and the buttons (sheet: the whole body). */
  children?: React.ReactNode;
  actions?: PopupAction[];
  /** Tap outside, Android back, and the sheet's close button. Omit to force a choice from the buttons. */
  onDismiss?: () => void;
  testID?: string;
  /** Test ID for the sheet's close button. */
  closeTestID?: string;
}

export const Popup: React.FC<PopupProps> = ({
  open,
  title,
  message,
  messageTestID,
  layout = 'center',
  presentation = 'modal',
  badge,
  children,
  actions,
  onDismiss,
  testID,
  closeTestID,
}) => {
  const c = useTheme();
  const insets = useSafeAreaInsets();

  const centerCard = (
    <View style={[styles.card, { backgroundColor: c.bgCard, borderColor: c.border }]}>
      {badge}
      <View style={styles.titles}>
        <Text accessibilityRole="header" style={[type.heading, styles.center, { color: c.text }]}>
          {title}
        </Text>
        {message ? (
          <Text testID={messageTestID} style={[type.bodySmall, styles.center, { color: c.textSecondary }]}>
            {message}
          </Text>
        ) : null}
      </View>
      {children}
      {actions && actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((a) => (
            <AppButton key={a.label} testID={a.testID} title={a.label} variant={a.variant ?? 'primary'} size="md" onPress={a.onPress} style={styles.action} />
          ))}
        </View>
      ) : null}
    </View>
  );

  const sheetCard = (
    <View style={[styles.sheet, { backgroundColor: c.bgCard, borderColor: c.border, paddingBottom: ms(20) + insets.bottom }]}>
      <View style={[styles.handle, { backgroundColor: c.border }]} />
      <View style={styles.titleRow}>
        <Text accessibilityRole="header" style={[type.heading, styles.sheetTitle, { color: c.text }]}>
          {title}
        </Text>
        {onDismiss ? (
          <Pressy testID={closeTestID} accessibilityLabel="Close" onPress={onDismiss} style={styles.close}>
            <X size={ms(20)} color={c.textSecondary} />
          </Pressy>
        ) : null}
      </View>
      {children}
    </View>
  );

  const card = layout === 'sheet' ? sheetCard : centerCard;
  const backdropStyle = layout === 'sheet' ? styles.bottom : styles.centered;

  if (presentation === 'overlay') {
    if (!open) return null;
    return (
      <View testID={testID} accessibilityViewIsModal style={[styles.fill, backdropStyle, { backgroundColor: c.scrim }]}>
        {card}
      </View>
    );
  }

  return (
    <Modal visible={open} transparent animationType={layout === 'sheet' ? 'slide' : 'fade'} onRequestClose={onDismiss} statusBarTranslucent>
      <View testID={testID} style={[styles.fill, backdropStyle, { backgroundColor: c.scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityLabel="Close dialog" />
        {card}
        {/* A Modal is its own native window: the root toast cannot draw above it, so it hosts the toast itself. */}
        <OverlayToast />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, elevation: 10 },
  centered: { alignItems: 'center', justifyContent: 'center', padding: space.lg },
  bottom: { justifyContent: 'flex-end' },
  card: { width: '100%', maxWidth: ms(340), borderRadius: radius.lg, borderWidth: 1, padding: space.lg, gap: space.md, alignItems: 'center' },
  titles: { alignItems: 'center', gap: space.xs, alignSelf: 'stretch' },
  center: { textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: space.sm },
  action: { minHeight: ms(44), borderRadius: radius.md },
  sheet: { borderTopWidth: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: ms(20), paddingTop: 10, gap: ms(12), maxHeight: '92%' },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  sheetTitle: { flex: 1 },
  close: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
