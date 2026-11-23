import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius } from '../../design-system/radius';
import { fonts, type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { OverlayToast } from '../feedback/AppToast';
import { AppButton } from './AppButton';
import { Pressy } from './Pressy';

import { fs, ms } from '../../design-system/responsive';
/** Bottom-sheet style modal (prototype CustomModal). Android hardware back closes it. */
export const AppModal: React.FC<{
  open: boolean;
  title: string;
  onClose?: () => void;
  children: React.ReactNode;
}> = ({ open, title, onClose, children }) => {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.fill}>
        <Pressable style={[styles.backdrop, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="Close dialog">
          <Pressable
            onPress={() => undefined}
            style={[styles.sheet, { backgroundColor: c.bgCard, borderColor: c.border, paddingBottom: ms(20) + insets.bottom }]}
          >
            <View style={[styles.handle, { backgroundColor: c.border }]} />
            <View style={styles.titleRow}>
              <Text accessibilityRole="header" style={[styles.sheetTitle, { color: c.text }]}>{title}</Text>
              {onClose ? (
                <Pressy accessibilityLabel="Close" onPress={onClose} style={styles.close}>
                  <X size={ms(20)} color={c.textSecondary} />
                </Pressy>
              ) : null}
            </View>
            {children}
          </Pressable>
        </Pressable>
        {/* A Modal is its own native window: the root toast cannot draw above it, so it hosts the toast itself. */}
        <OverlayToast />
      </View>
    </Modal>
  );
};

/** Centered confirmation dialog (prototype ConfirmationDialog). */
export const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', destructive, onConfirm, onCancel }) => {
  const c = useTheme();
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.fill}>
        <View style={[styles.backdrop, { backgroundColor: c.scrim, justifyContent: 'center', padding: ms(20) }]}>
          <View style={[styles.dialog, { backgroundColor: c.bgCard, borderColor: c.border }]}>
            <Text style={[styles.dialogTitle, { color: c.text }]}>{title}</Text>
            <Text style={[styles.dialogMessage, { color: c.textSecondary }]}>{message}</Text>
            <View style={styles.actions}>
              <AppButton title={cancelLabel} variant="secondary" size="md" onPress={onCancel} style={styles.dialogBtn} />
              <AppButton title={confirmLabel} variant={destructive ? 'danger' : 'primary'} size="md" onPress={onConfirm} style={styles.dialogBtn} />
            </View>
          </View>
        </View>
        <OverlayToast />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopWidth: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: ms(20), paddingTop: 10, gap: ms(12), maxHeight: '92%' },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center' },
  sheetTitle: { flex: 1, fontSize: fs(15), lineHeight: Math.round(fs(15) * 1.3), fontFamily: fonts.body.semibold },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  close: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  dialog: { width: '100%', maxWidth: ms(340), alignSelf: 'center', borderRadius: 20, borderWidth: 1, padding: ms(20) },
  dialogTitle: { fontSize: fs(17), lineHeight: Math.round(fs(17) * 1.3), fontFamily: fonts.body.semibold, letterSpacing: -0.2 },
  dialogMessage: { fontSize: fs(12.5), lineHeight: Math.round(fs(12.5) * 1.4), fontFamily: fonts.body.regular, marginTop: 6 },
  dialogBtn: { flex: 1, minHeight: 44, borderRadius: 12 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
});
