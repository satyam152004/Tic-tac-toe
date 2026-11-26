import React from 'react';
import { Popup } from './Popup';

/** Bottom sheet for lists and forms. Drawn by the shared Popup (layout 'sheet'). */
export const AppModal: React.FC<{
  open: boolean;
  title: string;
  onClose?: () => void;
  children: React.ReactNode;
}> = ({ open, title, onClose, children }) => (
  <Popup open={open} title={title} layout="sheet" onDismiss={onClose}>
    {children}
  </Popup>
);

/** Confirmation dialog. Drawn by the shared Popup (layout 'center'). */
export const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', destructive, onConfirm, onCancel }) => (
  <Popup
    open={open}
    title={title}
    message={message}
    onDismiss={onCancel}
    actions={[
      { label: cancelLabel, variant: 'secondary', onPress: onCancel },
      { label: confirmLabel, variant: destructive ? 'danger' : 'primary', onPress: onConfirm },
    ]}
  />
);
