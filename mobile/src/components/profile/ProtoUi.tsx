import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { fonts } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { Pressy } from '../common/Pressy';

/** `ui-section-label` from the prototype: 10px bold uppercase caption above a group. */
export const SectionLabel: React.FC<{ children: string }> = ({ children }) => {
  const c = useTheme();
  return <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>{children.toUpperCase()}</Text>;
};

/** `ui-group`: bordered 14px card whose rows are separated by hairlines. */
export const Group: React.FC<{ children: React.ReactNode; testID?: string }> = ({ children, testID }) => {
  const c = useTheme();
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View testID={testID} style={[styles.group, { backgroundColor: c.bgCard, borderColor: c.border }]}>
      {rows.map((row, i) => (
        <View key={i} style={i > 0 ? { borderTopWidth: 1, borderTopColor: c.border } : undefined}>
          {row}
        </View>
      ))}
    </View>
  );
};

/** `ui-group-row` (34px compact variant by default). */
export const GroupRow: React.FC<{
  label: string;
  labelColor?: string;
  labelWeight?: 'medium' | 'semibold';
  right?: React.ReactNode;
  value?: string;
  valueColor?: string;
  chevron?: boolean;
  onPress?: () => void;
  testID?: string;
  minHeight?: number;
}> = ({ label, labelColor, labelWeight = 'medium', right, value, valueColor, chevron, onPress, testID, minHeight = 34 }) => {
  const c = useTheme();
  const body = (
    <>
      <Text style={[styles.rowLabel, { color: labelColor ?? c.text, fontFamily: fonts.body[labelWeight] }]}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={[styles.rowValue, { color: valueColor ?? c.textSecondary }]}>{value}</Text> : null}
        {right}
        {chevron ? <ChevronRight size={14} color="#8E939E" /> : null}
      </View>
    </>
  );
  const style = [styles.row, { minHeight }];
  return onPress ? (
    <Pressy testID={testID} accessibilityLabel={label} scaleTo={0.995} onPress={onPress} style={style}>
      {body}
    </Pressy>
  ) : (
    <View testID={testID} style={style}>
      {body}
    </View>
  );
};

/** Three-way segmented control (`grid-cols-3 p-1 rounded-[10px]`). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  testIDPrefix,
}: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (id: T) => void;
  testIDPrefix?: string;
}) {
  const c = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: c.bgSecondary, borderColor: c.border }]}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <Pressy
            key={o.id}
            testID={testIDPrefix ? `${testIDPrefix}${o.id}` : undefined}
            accessibilityLabel={o.label}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.id)}
            style={[styles.segmentBtn, active && { backgroundColor: c.bgCard }]}
          >
            <Text style={[styles.segmentText, { color: active ? c.accent : c.textSecondary }]}>{o.label}</Text>
          </Pressy>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { fontSize: 10, fontFamily: fonts.body.semibold, letterSpacing: 0.5, marginBottom: 5, paddingLeft: 2 },
  group: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  row: { paddingVertical: 6, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowLabel: { fontSize: 12 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowValue: { fontSize: 11.5, fontFamily: fonts.body.semibold },
  segment: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: 10, borderWidth: 1 },
  segmentBtn: { flex: 1, paddingVertical: 4, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 11, fontFamily: fonts.body.semibold },
});
