import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ms } from '../../design-system/responsive';
import { useTheme } from '../../hooks/useTheme';

/** 44x26 pill switch (kit 36x20, enlarged for phones) from the UI kit. Purely visual: the surrounding row owns the press and the switch semantics. */
export const ToggleSwitch: React.FC<{ value: boolean }> = ({ value }) => {
  const c = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: value ? c.accent : c.border }]}>
      <View style={[styles.thumb, { transform: [{ translateX: value ? ms(18) : 0 }] }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  track: { width: ms(44), height: ms(26), borderRadius: ms(13), padding: 3, justifyContent: 'center' },
  thumb: { width: ms(20), height: ms(20), borderRadius: ms(10), backgroundColor: '#FFFFFF', shadowColor: '#000000', shadowOpacity: 0.15, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
});
