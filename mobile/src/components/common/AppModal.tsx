import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius } from '../../design-system/radius';
import { type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { OverlayToast } from '../feedback/AppToast';
import { AppButton } from './AppButton';
import { Pressy } from './Pressy';

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
            style={[styles.sheet, { backgroundColor: c.bgCard, borderColor: c.border, paddingBottom: 20 + insets.bottom, borderRadius: radius.xl }]}
          >
            <View style={styles.titleRow}>
              <Text style={[type.headline, { color: c.text, flex: 1 }]}>{title}</Text>
              {onClose ? (
                <Pressy accessibilityLabel="Close" onPress={onClose} style={styles.close}>
                  <X size={18} color={c.textSecondary} />
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
        <View style={[styles.backdrop, { backgroundColor: c.scrim, justifyContent: 'center', padding: 20 }]}>
          <View style={[styles.dialog, { backgroundColor: c.bgCard, borderColor: c.border }]}>
            <Text style={[type.headline, { color: c.text }]}>{title}</Text>
            <Text style={[type.body, { color: c.textSecondary, marginTop: 6 }]}>{message}</Text>
            <View style={styles.actions}>
              <AppButton title={cancelLabel} variant="outline" size="md" onPress={onCancel} style={{ flex: 1 }} />
              <AppButton title={confirmLabel} variant={destructive ? 'danger' : 'primary'} size="md" onPress={onConfirm} style={{ flex: 1 }} />
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
  backdrop: { flex: 1, justifyContent: 'flex-end', padding: 12 },
  sheet: { borderWidth: 1, padding: 20, gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  close: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  dialog: { borderRadius: radius.xl, borderWidth: 1, padding: 20 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
});
