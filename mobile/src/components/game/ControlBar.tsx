import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radius } from '../../design-system/radius';
import { space } from '../../design-system/spacing';
import { type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { Pressy } from '../common/Pressy';
import { CHROME } from './boardLayout';

/** One game control: icon over label (or icon beside label when the bar is stacked). Never truncates its label. */
export const ControlTile: React.FC<{
  testID?: string;
  label: string;
  icon: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  /** Full-width row (icon left of label), used when large system fonts make equal-width columns too narrow. */
  row?: boolean;
  /** Slim 36dp tile with the icon beside the label (the board screens' control strip). */
  inline?: boolean;
}> = ({ testID, label, icon, onPress, disabled, row, inline }) => {
  const c = useTheme();
  return (
    <Pressy
      testID={testID}
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={[
        styles.tile,
        row || inline ? styles.row : styles.column,
        inline && !row && styles.inline,
        { minHeight: row ? CHROME.controlRow : inline ? 36 : CHROME.control, backgroundColor: c.bgCard, borderColor: c.border, opacity: disabled ? 0.45 : 1 },
      ]}
    >
      {icon}
      {/* No numberOfLines={1}: at large font scales the label wraps instead of being cut off. */}
      <Text style={[type.caption, { color: c.text }, inline && styles.inlineLabel, !row && styles.centered]}>{label}</Text>
    </Pressy>
  );
};

/**
 * Equal-width control tiles. With large system fonts (`stacked`) the tiles become full-width rows, so labels keep
 * their full size and stay readable rather than being shrunk to fit a third of the screen.
 */
export const ControlBar: React.FC<{ stacked?: boolean; children: React.ReactNode }> = ({ stacked, children }) => (
  <View testID="board-controls" style={stacked ? styles.stack : styles.bar}>
    {React.Children.map(children, (child) =>
      React.isValidElement<{ row?: boolean }>(child) ? React.cloneElement(child, { row: !!stacked }) : child,
    )}
  </View>
);

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', gap: space.sm },
  stack: { flexDirection: 'column', gap: CHROME.controlGap },
  tile: { borderRadius: radius.md, borderWidth: 1, paddingVertical: space.sm, paddingHorizontal: space.sm, alignItems: 'center', justifyContent: 'center', gap: space.xs },
  column: { flex: 1, flexDirection: 'column' },
  row: { flexDirection: 'row', gap: space.sm, alignSelf: 'stretch' },
  centered: { textAlign: 'center' },
  inline: { flex: 1, borderRadius: 10, paddingVertical: 0, gap: 4 },
  inlineLabel: { fontSize: 11.5, lineHeight: 16 },
});
