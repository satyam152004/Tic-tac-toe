import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { Pressy } from '../common/Pressy';

export interface SegmentOption<T extends string | number> {
  value: T;
  label: string;
  testID?: string;
}

/**
 * Pill-track segmented selector from the UI kit: tinted track with a white active segment in the accent colour.
 * `sm` (padding 2, 10.5px labels) is the in-game variant, `md` (padding 4, 12px labels) the form variant.
 */
export function SegmentedControl<T extends string | number>({
  options, value, onChange, size = 'md', disabled, label,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
  label?: string;
}) {
  const c = useTheme();
  const sm = size === 'sm';
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[styles.track, { padding: sm ? 2 : 4, borderRadius: sm ? 9 : 10, backgroundColor: c.bgSecondary, borderColor: c.border }]}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressy
            key={String(o.value)}
            testID={o.testID}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: active, disabled: !!disabled }}
            disabled={disabled}
            onPress={disabled ? undefined : () => onChange(o.value)}
            scaleTo={0.99}
            style={[
              styles.seg,
              { paddingVertical: sm ? 4 : 6, borderRadius: sm ? 7 : 8, minHeight: sm ? 28 : 32 },
              active && [styles.active, { backgroundColor: c.bgCard }],
              disabled && { opacity: 0.5 },
            ]}
          >
            <Text style={{ fontFamily: fonts.body.semibold, fontSize: sm ? 10.5 : 12, color: active ? c.accent : c.textSecondary }}>{o.label}</Text>
          </Pressy>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', gap: 4, borderWidth: 1 },
  seg: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  active: { shadowColor: '#141518', shadowOpacity: 0.06, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
});
