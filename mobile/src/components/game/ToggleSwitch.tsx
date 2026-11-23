import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

/** 36x20 pill switch from the UI kit. Purely visual: the surrounding row owns the press and the switch semantics. */
export const ToggleSwitch: React.FC<{ value: boolean }> = ({ value }) => {
  const c = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: value ? c.accent : c.border }]}>
      <View style={[styles.thumb, { transform: [{ translateX: value ? 16 : 0 }] }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  track: { width: 36, height: 20, borderRadius: 10, padding: 2, justifyContent: 'center' },
  thumb: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFFFFF', shadowColor: '#000000', shadowOpacity: 0.15, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
});
