import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { findAvatar } from '../../constants/avatars';
import { fonts } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';

export type PresenceStatus = 'online' | 'in_game' | 'offline';

const DIM = { sm: 36, md: 44, lg: 56, xl: 80 } as const;
const FONT = { sm: 12, md: 14, lg: 16, xl: 20 } as const;

export const AppAvatar: React.FC<{
  avatarId?: string | null;
  name?: string;
  size?: keyof typeof DIM;
  status?: PresenceStatus;
  activeRing?: boolean;
}> = ({ avatarId, name, size = 'md', status, activeRing }) => {
  const c = useTheme();
  const preset = findAvatar(avatarId);
  const d = DIM[size];
  const dot = { online: c.success, in_game: c.warning, offline: '#64748B' };
  return (
    <View style={{ width: d, height: d }} accessibilityLabel={name ? `${name} avatar` : 'avatar'}>
      <View style={[styles.box, { width: d, height: d, borderRadius: size === 'xl' ? 22 : 14 }, activeRing && { borderWidth: 2, borderColor: c.accent }]}>
        {preset.image ? (
          <Image source={preset.image} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <LinearGradient colors={preset.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill}>
            <Text style={{ fontFamily: fonts.display.bold, fontSize: FONT[size], color: '#fff' }}>
              {(name ? name.slice(0, 2) : preset.initials).toUpperCase()}
            </Text>
          </LinearGradient>
        )}
      </View>
      {status ? (
        <View style={[styles.dot, { backgroundColor: dot[status], borderColor: c.bgPrimary }]} />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  box: { overflow: 'hidden' },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', right: -2, bottom: -2, width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
});
