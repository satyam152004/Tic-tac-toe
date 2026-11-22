import React, { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/common/AppButton';
import { Pressy } from '../../components/common/Pressy';
import { fonts, type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { toast } from '../../store/toastStore';

export interface ReportPlayerModalProps {
  open: boolean;
  playerName?: string;
  onClose: () => void;
}

const REASONS = [
  { id: 'CHEATING', label: 'Cheating / Engine Assistance' },
  { id: 'ABUSE', label: 'Abusive Behaviour' },
  { id: 'STALLING', label: 'Intentional Timer Stalling' },
  { id: 'NAME', label: 'Inappropriate Username' },
];

export const ReportPlayerModal: React.FC<ReportPlayerModalProps> = ({
  open,
  playerName = 'Aarav Patel',
  onClose,
}) => {
  const c = useTheme();
  const [selected, setSelected] = useState('CHEATING');
  const [submitted, setSubmitted] = useState(false);

  const submit = () => {
    setSubmitted(true);
    toast.success('Report submitted', 'Thank you for keeping the arena fair');
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 1200);
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={[styles.card, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <View style={{ gap: 2 }}>
            <Text style={[styles.title, { color: c.text }]}>Report {playerName}</Text>
            <Text style={[styles.sub, { color: c.textSecondary }]}>
              Select a reason for our fair-play team.
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
                  <Text style={[styles.reasonText, { color: c.text }]}>{r.label}</Text>
                  <View
                    style={[
                      styles.radio,
                      { borderColor: active ? c.accent : c.border },
                    ]}
                  >
                    {active ? <View style={[styles.radioDot, { backgroundColor: c.accent }]} /> : null}
                  </View>
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
                title={submitted ? 'Reported ✓' : 'Submit Report'}
                variant="danger"
                size="md"
                onPress={submit}
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
    maxWidth: 300,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  title: {
    fontSize: 16,
    fontFamily: fonts.body.semibold,
  },
  sub: {
    fontSize: 11,
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
    paddingVertical: 10,
  },
  reasonText: {
    fontSize: 12,
    fontFamily: fonts.body.medium,
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
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
    gap: 8,
  },
});
