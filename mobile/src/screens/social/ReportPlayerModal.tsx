import React, { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/common/AppButton';
import { Pressy } from '../../components/common/Pressy';
import { fonts, type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { friendlyMessage } from '../../services/api/errors';
import { userApi, type ReportReason } from '../../services/api/userApi';
import { toast } from '../../store/toastStore';

import { fs, ms } from '../../design-system/responsive';
export interface ReportPlayerModalProps {
  open: boolean;
  /** The reported player (server id). */
  userId: string;
  playerName?: string;
  /** Game the behaviour happened in, when known. */
  gameId?: string;
  onClose: () => void;
}

const REASONS: Array<{ id: ReportReason; label: string }> = [
  { id: 'CHEATING', label: 'Cheating' },
  { id: 'ABUSE', label: 'Rude or abusive behavior' },
  { id: 'STALLING', label: 'Stalling on purpose' },
  { id: 'INAPPROPRIATE_NAME', label: 'Inappropriate username' },
];

export const ReportPlayerModal: React.FC<ReportPlayerModalProps> = ({
  open,
  userId,
  playerName = 'this player',
  gameId,
  onClose,
}) => {
  const c = useTheme();
  const [selected, setSelected] = useState<ReportReason>('CHEATING');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const submit = async () => {
    if (busy || submitted) return;
    setBusy(true);
    try {
      await userApi.report(userId, selected, undefined, gameId);
      setSubmitted(true);
      toast.success('Report sent', 'Thanks for helping keep games fair');
      timer.current = setTimeout(() => {
        setSubmitted(false);
        onClose();
      }, 1200);
    } catch (e) {
      toast.error("Couldn't send the report", friendlyMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={[styles.card, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <View style={{ gap: 2 }}>
            <Text style={[styles.title, { color: c.text }]}>Report {playerName}</Text>
            <Text style={[styles.sub, { color: c.textSecondary }]}>
              Pick a reason.
            </Text>
          </View>

          {/* Reason options */}
          <View style={[styles.group, { backgroundColor: c.bgCard, borderColor: c.border }]}>
            {REASONS.map((r, i) => {
              const active = selected === r.id;
              return (
                <Pressy
                  key={r.id}
                  testID={`report-reason-${r.id}`}
                  onPress={() => setSelected(r.id)}
                  style={[
                    styles.row,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
                    active && { backgroundColor: '#EFF4FF' },
                  ]}
                >
                  <Text style={[styles.reasonText, { flex: 1 }, { color: c.text }]}>{r.label}</Text>
                  <View
                    style={[
                      styles.radio,
                      active ? { borderColor: c.accent, borderWidth: ms(6), backgroundColor: c.bgCard } : { borderColor: c.border },
                    ]}
                  />
                </Pressy>
              );
            })}
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <AppButton
                testID="report-cancel"
                title="Cancel"
                variant="secondary"
                size="md"
                onPress={onClose}
              />
            </View>
            <View style={{ flex: 1 }}>
              <AppButton
                testID="report-submit"
                title={submitted ? 'Reported ✓' : 'Send report'}
                variant="danger"
                size="md"
                onPress={() => void submit()}
                loading={busy}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(20, 21, 24, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: ms(360),
    borderRadius: 20,
    borderWidth: 1,
    padding: ms(18),
    gap: ms(14),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  title: {
    fontSize: fs(16),
    fontFamily: fonts.body.semibold,
  },
  sub: {
    fontSize: fs(12), lineHeight: Math.round(fs(12) * 1.35),
  },
  group: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 48,
    gap: 10,
  },
  reasonText: {
    fontSize: fs(12),
    fontFamily: fonts.body.medium,
  },
  radio: {
    width: ms(20),
    height: ms(20),
    borderRadius: ms(10),
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
});
